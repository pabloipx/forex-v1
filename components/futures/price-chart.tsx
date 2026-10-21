"use client"

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import useSWR from "swr"
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart,
  createTextWatermark,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type UTCTimestamp,
  type Time,
} from "lightweight-charts"
import { cn } from "@/lib/utils"
import { formatPrice, type FuturesMarket } from "@/lib/futures/markets"
import { INTERVALS, INTERVAL_SECONDS, type Candle, type ChartInterval } from "@/lib/futures/chart-intervals"
import type { Order, Position } from "@/lib/futures/types"
import { CHART_THEMES, type ChartTheme, type TermTheme } from "@/lib/futures/term-theme"

function chartLayoutOptions(t: ChartTheme) {
  return {
    layout: { background: { type: ColorType.Solid, color: t.bg }, textColor: t.text },
    grid: { vertLines: { color: t.grid }, horzLines: { color: t.grid } },
    crosshair: {
      vertLine: { color: t.crosshair, labelBackgroundColor: t.crosshairLabel },
      horzLine: { color: t.crosshair, labelBackgroundColor: t.crosshairLabel },
    },
    rightPriceScale: { borderColor: t.border },
    timeScale: { borderColor: t.border },
  }
}
import { DrawingLayer, DrawingToolbar, useDrawingState } from "./chart-drawings"
import { useChartScripts } from "@/hooks/use-chart-scripts"
import { ScriptEditor } from "./script-editor"
import { useScriptOverlay } from "./use-script-overlay"

const COLORS = {
  up: "#089981",
  down: "#f23645",
  accent: "#2190ff",
  liq: "#ff9800",
}

const INTERVAL_LABEL: Record<ChartInterval, string> = { "1m": "1m", "5m": "5m", "15m": "15m", "1h": "1h", "4h": "4h", "1d": "1D" }

type ChartStyle = "candles" | "line"

interface PriceChartProps {
  market: FuturesMarket
  theme: TermTheme
  last: number | null
  positions: Position[]
  openOrders: Order[]
  onLineDrag?: (positionId: string, kind: "tp" | "sl", price: number) => void
  toolbarExtra?: React.ReactNode
}

interface LineSpec {
  price: number
  color: string
  title: string
  dashed: boolean
  drag?: { positionId: string; kind: "tp" | "sl" }
}

const DRAG_HIT_PX = 6

const fetcher = async (url: string) => {
  const res = await fetch(url)
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? "Erro ao carregar histórico")
  return json.candles as Candle[]
}

function PriceChartImpl({ market, theme, last, positions, openOrders, onLineDrag, toolbarExtra }: PriceChartProps) {
  const palette = CHART_THEMES[theme]
  const paletteRef = useRef(palette)
  paletteRef.current = palette
  const [interval, setIntervalValue] = useState<ChartInterval>("15m")
  const [style, setStyle] = useState<ChartStyle>("candles")
  const [showVolume, setShowVolume] = useState(true)
  const [showLines, setShowLines] = useState(true)

  const containerRef = useRef<HTMLDivElement>(null)
  const legendRef = useRef<HTMLSpanElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null)
  const lineRef = useRef<ISeriesApi<"Line"> | null>(null)
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null)
  const lastCandleRef = useRef<Candle | null>(null)
  const hoverRef = useRef(false)
  const priceLinesRef = useRef<IPriceLine[]>([])
  const lineSpecsRef = useRef<LineSpec[]>([])
  const onLineDragRef = useRef(onLineDrag)
  onLineDragRef.current = onLineDrag
  const watermarkRef = useRef<ReturnType<typeof createTextWatermark<Time>> | null>(null)
  const pendingPriceRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)
  const decimalsRef = useRef(market.priceDecimals)
  const intervalRef = useRef(interval)
  const loadedKeyRef = useRef<string | null>(null)
  const barsRef = useRef<Candle[]>([])
  const styleRef = useRef(style)
  const [chartApi, setChartApi] = useState<IChartApi | null>(null)
  const drawing = useDrawingState(market.symbol)

  decimalsRef.current = market.priceDecimals
  intervalRef.current = interval
  styleRef.current = style

  const getSeries = useCallback(
    () => (styleRef.current === "candles" ? candleRef.current : lineRef.current) as ISeriesApi<"Candlestick" | "Line"> | null,
    [],
  )

  const key = `/api/futures/candles?symbol=${market.symbol}&interval=${interval}`
  // Ressincroniza o historico real periodicamente; entre um refresh e outro o motor atualiza a ultima vela.
  const { data: candles, error, isLoading } = useSWR(key, fetcher, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
    dedupingInterval: 30_000,
    refreshInterval: 60_000,
    keepPreviousData: false,
  })

  const [editorOpen, setEditorOpen] = useState(false)
  const scriptStore = useChartScripts()
  const getMain = useCallback(() => candleRef.current, [])
  const [panelOpen, setPanelOpen] = useState(true)
  const { errors: scriptErrors, panels: scriptPanels } = useScriptOverlay({
    chart: chartApi,
    getMain,
    barsRef,
    scripts: scriptStore.scripts,
    dataVersion: candles,
    decimals: market.priceDecimals,
  })
  const activeScripts = scriptStore.scripts.filter((s) => s.enabled)

  const renderLegend = (c: Candle | null) => {
    const el = legendRef.current
    if (!el) return
    if (!c) {
      el.textContent = ""
      return
    }
    const d = decimalsRef.current
    const color = c.close >= c.open ? COLORS.up : COLORS.down
    const change = c.open ? ((c.close - c.open) / c.open) * 100 : 0
    const delta = c.close - c.open
    const parts: [string, string][] = [
      ["A", formatPrice(c.open, d)],
      ["M", formatPrice(c.high, d)],
      ["m", formatPrice(c.low, d)],
      ["F", formatPrice(c.close, d)],
    ]
    el.replaceChildren(
      ...parts.flatMap(([label, value]) => {
        const l = document.createElement("span")
        l.style.color = paletteRef.current.text
        l.textContent = `${label} `
        const v = document.createElement("span")
        v.style.color = color
        v.textContent = `${value}  `
        return [l, v]
      }),
      Object.assign(document.createElement("span"), {
        textContent: `${delta >= 0 ? "+" : ""}${formatPrice(delta, d)} (${change >= 0 ? "+" : ""}${change.toFixed(2)}%)`,
        style: `color:${color}`,
      }),
    )
  }

  // Cria o grafico uma unica vez; trocar de mercado/intervalo so troca os dados.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const t = paletteRef.current
    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: t.bg },
        textColor: t.text,
        fontSize: 11,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif",
        attributionLogo: false,
      },
      grid: { vertLines: { color: t.grid }, horzLines: { color: t.grid } },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: t.crosshair, width: 1, style: LineStyle.LargeDashed, labelBackgroundColor: t.crosshairLabel },
        horzLine: { color: t.crosshair, width: 1, style: LineStyle.LargeDashed, labelBackgroundColor: t.crosshairLabel },
      },
      rightPriceScale: { borderColor: t.border, scaleMargins: { top: 0.1, bottom: 0.2 } },
      timeScale: { borderColor: t.border, timeVisible: true, secondsVisible: false, rightOffset: 8, barSpacing: 7, minBarSpacing: 2 },
      kineticScroll: { touch: true, mouse: false },
      handleScroll: { vertTouchDrag: false },
      localization: { locale: "pt-BR" },
    })
    candleRef.current = chart.addSeries(CandlestickSeries, {
      upColor: COLORS.up,
      downColor: COLORS.down,
      borderUpColor: COLORS.up,
      borderDownColor: COLORS.down,
      wickUpColor: COLORS.up,
      wickDownColor: COLORS.down,
      priceLineStyle: LineStyle.Dotted,
    })
    watermarkRef.current = createTextWatermark(chart.panes()[0], {
      horzAlign: "center",
      vertAlign: "center",
      lines: [{ text: market.symbol, color: t.watermark, fontSize: 64, fontStyle: "bold" }],
    })
    lineRef.current = chart.addSeries(LineSeries, { color: COLORS.accent, lineWidth: 2, visible: false })
    volumeRef.current = chart.addSeries(HistogramSeries, {
      priceScaleId: "volume",
      priceFormat: { type: "volume" },
      lastValueVisible: false,
      priceLineVisible: false,
    })
    chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } })

    chart.subscribeCrosshairMove((param) => {
      const series = candleRef.current
      const d = series && param.time ? (param.seriesData.get(series) as Candle | undefined) : undefined
      hoverRef.current = !!d
      renderLegend(d && "open" in d ? d : lastCandleRef.current)
    })
    chartRef.current = chart
    setChartApi(chart)

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      setChartApi(null)
      chart.remove()
      chartRef.current = null
      candleRef.current = null
      lineRef.current = null
      volumeRef.current = null
      priceLinesRef.current = []
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Layout effects: o canvas troca de cor no mesmo frame que o CSS, sem piscar o tema antigo.
  useLayoutEffect(() => {
    watermarkRef.current?.applyOptions({
      lines: [{ text: market.symbol, color: palette.watermark, fontSize: 64, fontStyle: "bold" }],
    })
  }, [market.symbol, palette])

  useLayoutEffect(() => {
    chartRef.current?.applyOptions(chartLayoutOptions(palette))
    if (!hoverRef.current) renderLegend(lastCandleRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [palette])

  useEffect(() => {
    const fmt = { type: "price" as const, precision: market.priceDecimals, minMove: 10 ** -market.priceDecimals }
    candleRef.current?.applyOptions({ priceFormat: fmt })
    lineRef.current?.applyOptions({ priceFormat: fmt })
  }, [market.priceDecimals])

  // Limpa o grafico ao trocar de mercado/intervalo para nao misturar series.
  useEffect(() => {
    if (loadedKeyRef.current === key) return
    lastCandleRef.current = null
    barsRef.current = []
    candleRef.current?.setData([])
    lineRef.current?.setData([])
    volumeRef.current?.setData([])
    renderLegend(null)
  }, [key])

  useEffect(() => {
    if (!candles || !candleRef.current) return
    const t = (c: Candle) => c.time as UTCTimestamp
    candleRef.current.setData(candles.map((c) => ({ time: t(c), open: c.open, high: c.high, low: c.low, close: c.close })))
    lineRef.current?.setData(candles.map((c) => ({ time: t(c), value: c.close })))
    volumeRef.current?.setData(
      candles.map((c) => ({ time: t(c), value: c.volume, color: c.close >= c.open ? `${COLORS.up}55` : `${COLORS.down}55` })),
    )
    lastCandleRef.current = candles.at(-1) ? { ...candles.at(-1)! } : null
    barsRef.current = candles.map((c) => ({ ...c }))
    if (!hoverRef.current) renderLegend(lastCandleRef.current)
    if (loadedKeyRef.current !== key) {
      loadedKeyRef.current = key
      chartRef.current?.timeScale().scrollToRealTime()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles])

  useEffect(() => {
    candleRef.current?.applyOptions({ visible: style === "candles" })
    lineRef.current?.applyOptions({ visible: style === "line" })
  }, [style])

  useEffect(() => {
    volumeRef.current?.applyOptions({ visible: showVolume && market.source === "binance" })
  }, [showVolume, market.source])

  // Ticks do motor chegam varias vezes por segundo: agrupa em um update por frame.
  useEffect(() => {
    if (last == null) return
    pendingPriceRef.current = last
    if (rafRef.current != null) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
      const price = pendingPriceRef.current
      const prev = lastCandleRef.current
      if (price == null || !prev || !candleRef.current) return
      const step = INTERVAL_SECONDS[intervalRef.current]
      const now = Math.floor(Date.now() / 1000)
      let next: Candle
      if (now < prev.time + step) {
        if (price === prev.close && price <= prev.high && price >= prev.low) return
        next = { ...prev, high: Math.max(prev.high, price), low: Math.min(prev.low, price), close: price }
      } else {
        const time = prev.time + Math.floor((now - prev.time) / step) * step
        next = { time, open: prev.close, high: Math.max(prev.close, price), low: Math.min(prev.close, price), close: price, volume: 0 }
      }
      lastCandleRef.current = next
      const bars = barsRef.current
      if (bars.length && bars[bars.length - 1].time === next.time) bars[bars.length - 1] = next
      else bars.push(next)
      const time = next.time as UTCTimestamp
      candleRef.current.update({ time, open: next.open, high: next.high, low: next.low, close: next.close })
      lineRef.current?.update({ time, value: next.close })
      if (!hoverRef.current) renderLegend(next)
    })
  }, [last])

  // Assinatura estavel: so redesenha as linhas quando algo realmente muda.
  const lineSpecs = useMemo<LineSpec[]>(() => {
    const out: LineSpec[] = []
    const add = (
      price: number | null | undefined,
      color: string,
      title: string,
      dashed = true,
      drag?: LineSpec["drag"],
    ) => {
      if (price) out.push({ price: Number(price), color, title, dashed, drag })
    }
    for (const p of positions) {
      if (p.symbol !== market.symbol) continue
      add(p.entry_price, p.side === "long" ? COLORS.up : COLORS.down, `${p.side === "long" ? "Long" : "Short"} ${p.qty}`, false)
      add(p.liquidation_price, COLORS.liq, "Liq.")
      add(p.take_profit, COLORS.up, "TP ⇕", true, { positionId: p.id, kind: "tp" })
      add(p.stop_loss, COLORS.down, "SL ⇕", true, { positionId: p.id, kind: "sl" })
      if (p.trailing_distance && p.trailing_peak) {
        const stop = p.side === "long" ? p.trailing_peak - p.trailing_distance : p.trailing_peak + p.trailing_distance
        add(stop, COLORS.down, "Trailing")
      }
    }
    for (const o of openOrders) {
      if (o.symbol !== market.symbol) continue
      add(o.price ?? o.trigger_price, o.side === "buy" ? COLORS.up : COLORS.down, `${o.side === "buy" ? "Compra" : "Venda"} ${o.qty}`)
    }
    return out
  }, [positions, openOrders, market.symbol])
  const linesSignature = JSON.stringify(lineSpecs)

  useEffect(() => {
    const series = candleRef.current
    if (!series) return
    for (const l of priceLinesRef.current) series.removePriceLine(l)
    priceLinesRef.current = []
    lineSpecsRef.current = []
    if (!showLines) return
    lineSpecsRef.current = lineSpecs
    for (const l of lineSpecs) {
      priceLinesRef.current.push(
        series.createPriceLine({
          price: l.price,
          color: l.color,
          title: l.title,
          lineWidth: 1,
          lineStyle: l.dashed ? LineStyle.Dashed : LineStyle.Solid,
          axisLabelVisible: true,
        }),
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linesSignature, showLines])

  // Arraste de TP/SL: usa a fase de captura para ter prioridade sobre o pan do gráfico e as ferramentas de desenho.
  useEffect(() => {
    const el = containerRef.current
    const chart = chartApi
    if (!el || !chart) return
    let dragging: { index: number; price: number } | null = null

    const hit = (y: number) => {
      const series = candleRef.current
      if (!series) return -1
      return lineSpecsRef.current.findIndex((l) => {
        if (!l.drag) return false
        const coord = series.priceToCoordinate(l.price)
        return coord != null && Math.abs(coord - y) <= DRAG_HIT_PX
      })
    }
    const localY = (e: PointerEvent) => e.clientY - el.getBoundingClientRect().top

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      const index = hit(localY(e))
      if (index < 0) return
      e.stopPropagation()
      e.preventDefault()
      dragging = { index, price: lineSpecsRef.current[index].price }
      chart.applyOptions({ handleScroll: false, handleScale: false })
      el.setPointerCapture(e.pointerId)
    }
    const onMove = (e: PointerEvent) => {
      const y = localY(e)
      if (!dragging) {
        el.style.cursor = hit(y) >= 0 ? "ns-resize" : ""
        return
      }
      e.stopPropagation()
      const price = candleRef.current?.coordinateToPrice(y)
      if (price == null || price <= 0) return
      const rounded = Number(price.toFixed(decimalsRef.current))
      dragging.price = rounded
      const spec = lineSpecsRef.current[dragging.index]
      priceLinesRef.current[dragging.index]?.applyOptions({
        price: rounded,
        title: `${spec.drag?.kind === "tp" ? "TP" : "SL"} ${formatPrice(rounded, decimalsRef.current)}`,
      })
    }
    const onUp = (e: PointerEvent) => {
      if (!dragging) return
      e.stopPropagation()
      const spec = lineSpecsRef.current[dragging.index]
      const { price } = dragging
      dragging = null
      el.style.cursor = ""
      chart.applyOptions({ handleScroll: true, handleScale: true })
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
      if (spec?.drag && price !== spec.price) onLineDragRef.current?.(spec.drag.positionId, spec.drag.kind, price)
    }

    el.addEventListener("pointerdown", onDown, true)
    el.addEventListener("pointermove", onMove, true)
    el.addEventListener("pointerup", onUp, true)
    el.addEventListener("pointercancel", onUp, true)
    return () => {
      el.removeEventListener("pointerdown", onDown, true)
      el.removeEventListener("pointermove", onMove, true)
      el.removeEventListener("pointerup", onUp, true)
      el.removeEventListener("pointercancel", onUp, true)
    }
  }, [chartApi])

  const toolBtn = (active: boolean) =>
    cn(
      "shrink-0 rounded px-1.5 py-1 text-xs font-medium transition-colors",
      active ? "bg-primary/15 text-primary" : "text-term-muted hover:bg-term-line hover:text-term-text",
    )

  return (
    <section aria-label="Gráfico" className="flex h-full flex-col bg-term-panel">
      <div className="flex items-center gap-3 overflow-x-auto border-b border-term-line px-3 py-1.5 [scrollbar-width:none]">
        {toolbarExtra && (
          <>
            <div className="shrink-0">{toolbarExtra}</div>
            <span className="h-4 w-px shrink-0 bg-term-line" aria-hidden="true" />
          </>
        )}
        <div role="radiogroup" aria-label="Intervalo" className="flex shrink-0 items-center gap-0.5">
          {INTERVALS.map((i) => (
            <button key={i} role="radio" aria-checked={interval === i} onClick={() => setIntervalValue(i)} className={toolBtn(interval === i)}>
              {INTERVAL_LABEL[i]}
            </button>
          ))}
        </div>
        <span className="h-4 w-px shrink-0 bg-term-line" aria-hidden="true" />
        <div role="radiogroup" aria-label="Tipo de gráfico" className="flex shrink-0 items-center gap-0.5">
          <button role="radio" aria-checked={style === "candles"} onClick={() => setStyle("candles")} className={toolBtn(style === "candles")}>
            Velas
          </button>
          <button role="radio" aria-checked={style === "line"} onClick={() => setStyle("line")} className={toolBtn(style === "line")}>
            Linha
          </button>
        </div>
        <span className="h-4 w-px shrink-0 bg-term-line" aria-hidden="true" />
        {market.source === "binance" && (
          <button aria-pressed={showVolume} onClick={() => setShowVolume((v) => !v)} className={toolBtn(showVolume)}>
            Volume
          </button>
        )}
        <button aria-pressed={showLines} onClick={() => setShowLines((v) => !v)} className={toolBtn(showLines)}>
          Posições
        </button>
        <button onClick={() => chartRef.current?.timeScale().fitContent()} className={toolBtn(false)}>
          Ajustar
        </button>
        <button onClick={() => chartRef.current?.timeScale().scrollToRealTime()} className={toolBtn(false)}>
          Tempo real
        </button>
        <span className="h-4 w-px shrink-0 bg-term-line" aria-hidden="true" />
        <button
          onClick={() => setEditorOpen(true)}
          aria-haspopup="dialog"
          className={cn(toolBtn(activeScripts.length > 0), "flex items-center gap-1 font-mono")}
        >
          {"</>"}
          <span className="font-sans">Scripts{activeScripts.length ? ` (${activeScripts.length})` : ""}</span>
        </button>
      </div>
      <ScriptEditor open={editorOpen} onOpenChange={setEditorOpen} store={scriptStore} errors={scriptErrors} />

      <div className="flex min-h-0 flex-1">
      <DrawingToolbar state={drawing} />
      <div className="relative min-h-0 min-w-0 flex-1">
        {chartApi && (
          <DrawingLayer
            state={drawing}
            chart={chartApi}
            getSeries={getSeries}
            barsRef={barsRef}
            step={INTERVAL_SECONDS[interval]}
            decimals={market.priceDecimals}
          />
        )}
        <div className="pointer-events-none absolute left-3 top-2 z-10 flex flex-wrap items-center gap-x-2 font-mono text-[11px]">
          <span className="font-sans font-semibold text-term-text">
            {market.symbol} · {INTERVAL_LABEL[interval]}
          </span>
          <span ref={legendRef} className="whitespace-pre" />
          {activeScripts.length > 0 && (
            <span className="pointer-events-auto flex basis-full flex-wrap gap-1 pt-0.5 font-sans">
              {activeScripts.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setEditorOpen(true)}
                  title={scriptErrors[s.id] ?? s.name}
                  className={cn(
                    "rounded bg-term-bg/80 px-1.5 py-px text-[10px]",
                    scriptErrors[s.id] ? "text-term-down" : "text-term-muted hover:text-term-text",
                  )}
                >
                  {s.name}
                  {scriptErrors[s.id] ? " · erro" : ""}
                </button>
              ))}
            </span>
          )}
        </div>
        {scriptPanels.length > 0 && (
          <div className="absolute right-16 top-2 z-10 flex max-w-44 flex-col gap-1">
            {scriptPanels.map((p, idx) => (
              <section
                key={idx}
                aria-label={p.title || p.rows[0]?.label || "Painel do script"}
                className="overflow-hidden rounded border border-term-line bg-term-bg/90 font-mono text-[10px] leading-tight"
              >
                <button
                  type="button"
                  onClick={() => setPanelOpen((v) => !v)}
                  aria-expanded={panelOpen}
                  className="flex min-h-6 w-full items-center justify-between gap-3 px-2 py-1 text-left"
                >
                  <span className="truncate font-semibold" style={{ color: p.rows[0]?.color }}>
                    {p.title || p.rows[0]?.label}
                  </span>
                  <span style={{ color: p.rows[0]?.color }}>{p.title ? (panelOpen ? "−" : "+") : p.rows[0]?.value}</span>
                </button>
                {panelOpen && (
                  <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 border-t border-term-line px-2 py-1">
                    {(p.title ? p.rows : p.rows.slice(1)).map((r, i) => (
                      <div key={i} className="contents">
                        <dt className="text-term-muted">{r.label}</dt>
                        <dd className="text-right font-semibold" style={{ color: r.color }}>
                          {r.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </section>
            ))}
          </div>
        )}
        {(isLoading || error) && !candles && (
          <p className="absolute inset-0 z-10 flex items-center justify-center text-xs text-term-muted">
            {error ? (error as Error).message : "Carregando gráfico..."}
          </p>
        )}
        <div ref={containerRef} className="h-full w-full touch-pan-y" />
      </div>
      </div>
    </section>
  )
}

export const PriceChart = memo(PriceChartImpl)
