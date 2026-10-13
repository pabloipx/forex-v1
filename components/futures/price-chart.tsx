"use client"

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import useSWR from "swr"
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  LineSeries,
  LineStyle,
  createChart,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts"
import { cn } from "@/lib/utils"
import { formatPrice, type FuturesMarket } from "@/lib/futures/markets"
import { INTERVALS, INTERVAL_SECONDS, type Candle, type ChartInterval } from "@/lib/futures/candles"
import type { Order, Position } from "@/lib/futures/types"
import { DrawingLayer, DrawingToolbar, useDrawingState } from "./chart-drawings"

const COLORS = {
  bg: "#15181d",
  grid: "rgba(43, 49, 57, 0.5)",
  text: "#848e9c",
  up: "#20b26c",
  down: "#ef454a",
  accent: "#f7a600",
}

const INTERVAL_LABEL: Record<ChartInterval, string> = { "1m": "1m", "5m": "5m", "15m": "15m", "1h": "1h", "4h": "4h", "1d": "1D" }

type ChartStyle = "candles" | "line"

interface PriceChartProps {
  market: FuturesMarket
  last: number | null
  positions: Position[]
  openOrders: Order[]
}

interface LineSpec {
  price: number
  color: string
  title: string
  dashed: boolean
}

const fetcher = async (url: string) => {
  const res = await fetch(url)
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? "Erro ao carregar histórico")
  return json.candles as Candle[]
}

function PriceChartImpl({ market, last, positions, openOrders }: PriceChartProps) {
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
  const { data: candles, error, isLoading } = useSWR(key, fetcher, {
    revalidateOnFocus: false,
    revalidateIfStale: false,
    dedupingInterval: 30_000,
  })

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
    el.style.color = color
    el.textContent = `A ${formatPrice(c.open, d)}  M ${formatPrice(c.high, d)}  m ${formatPrice(c.low, d)}  F ${formatPrice(c.close, d)}  ${change >= 0 ? "+" : ""}${change.toFixed(2)}%`
  }

  // Cria o grafico uma unica vez; trocar de mercado/intervalo so troca os dados.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const chart = createChart(el, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: COLORS.bg },
        textColor: COLORS.text,
        fontSize: 11,
        attributionLogo: false,
      },
      grid: { vertLines: { color: COLORS.grid }, horzLines: { color: COLORS.grid } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: COLORS.grid, scaleMargins: { top: 0.1, bottom: 0.2 } },
      timeScale: { borderColor: COLORS.grid, timeVisible: true, secondsVisible: false, rightOffset: 6, barSpacing: 8 },
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
    const add = (price: number | null | undefined, color: string, title: string, dashed = true) => {
      if (price) out.push({ price: Number(price), color, title, dashed })
    }
    for (const p of positions) {
      if (p.symbol !== market.symbol) continue
      add(p.entry_price, p.side === "long" ? COLORS.up : COLORS.down, `${p.side === "long" ? "Long" : "Short"} ${p.qty}`, false)
      add(p.liquidation_price, COLORS.accent, "Liq.")
      add(p.take_profit, COLORS.up, "TP")
      add(p.stop_loss, COLORS.down, "SL")
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
    if (!showLines) return
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

  const toolBtn = (active: boolean) =>
    cn(
      "shrink-0 rounded px-1.5 py-0.5 text-xs font-medium transition-colors",
      active ? "text-primary" : "text-term-muted hover:text-term-text",
    )

  return (
    <section aria-label="Gráfico" className="flex h-full flex-col bg-term-panel">
      <div className="flex items-center gap-3 overflow-x-auto border-b border-term-line px-3 py-1.5 [scrollbar-width:none]">
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
      </div>

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
        </div>
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
