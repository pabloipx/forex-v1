"use client"

import { useEffect, useRef, useState } from "react"
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

const fetcher = async (url: string) => {
  const res = await fetch(url)
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? "Erro ao carregar histórico")
  return json.candles as Candle[]
}

export function PriceChart({ market, last, positions, openOrders }: PriceChartProps) {
  const [interval, setIntervalValue] = useState<ChartInterval>("15m")
  const [style, setStyle] = useState<ChartStyle>("candles")
  const [showVolume, setShowVolume] = useState(true)
  const [showLines, setShowLines] = useState(true)
  const [legend, setLegend] = useState<Candle | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null)
  const lineRef = useRef<ISeriesApi<"Line"> | null>(null)
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null)
  const lastCandleRef = useRef<Candle | null>(null)
  const priceLinesRef = useRef<IPriceLine[]>([])

  const { data: candles, error, isLoading } = useSWR(
    `/api/futures/candles?symbol=${market.symbol}&interval=${interval}`,
    fetcher,
    { revalidateOnFocus: false, refreshInterval: 60_000 },
  )

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const chart = createChart(el, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: COLORS.bg }, textColor: COLORS.text, fontSize: 11 },
      grid: { vertLines: { color: COLORS.grid }, horzLines: { color: COLORS.grid } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: COLORS.grid },
      timeScale: { borderColor: COLORS.grid, timeVisible: true, secondsVisible: false },
      localization: { locale: "pt-BR" },
    })
    const fmt = { type: "price" as const, precision: market.priceDecimals, minMove: 10 ** -market.priceDecimals }
    candleRef.current = chart.addSeries(CandlestickSeries, {
      upColor: COLORS.up,
      downColor: COLORS.down,
      borderUpColor: COLORS.up,
      borderDownColor: COLORS.down,
      wickUpColor: COLORS.up,
      wickDownColor: COLORS.down,
      priceFormat: fmt,
    })
    lineRef.current = chart.addSeries(LineSeries, { color: COLORS.accent, lineWidth: 2, priceFormat: fmt, visible: false })
    volumeRef.current = chart.addSeries(HistogramSeries, { priceScaleId: "volume", priceFormat: { type: "volume" } })
    chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } })

    chart.subscribeCrosshairMove((param) => {
      const d = param.seriesData.get(candleRef.current!) as Candle | undefined
      setLegend(d && "open" in d ? d : null)
    })
    chartRef.current = chart
    return () => {
      chart.remove()
      chartRef.current = null
      candleRef.current = null
      lineRef.current = null
      volumeRef.current = null
      priceLinesRef.current = []
    }
  }, [market.symbol, market.priceDecimals])

  useEffect(() => {
    if (!candles || !candleRef.current) return
    const t = (c: Candle) => c.time as UTCTimestamp
    candleRef.current.setData(candles.map((c) => ({ ...c, time: t(c) })))
    lineRef.current?.setData(candles.map((c) => ({ time: t(c), value: c.close })))
    volumeRef.current?.setData(
      candles.map((c) => ({ time: t(c), value: c.volume, color: c.close >= c.open ? `${COLORS.up}66` : `${COLORS.down}66` })),
    )
    lastCandleRef.current = candles.at(-1) ? { ...candles.at(-1)! } : null
    chartRef.current?.timeScale().scrollToRealTime()
  }, [candles])

  useEffect(() => {
    candleRef.current?.applyOptions({ visible: style === "candles" })
    lineRef.current?.applyOptions({ visible: style === "line" })
  }, [style, candles])

  useEffect(() => {
    volumeRef.current?.applyOptions({ visible: showVolume && market.source === "binance" })
  }, [showVolume, market.source, candles])

  // Atualizacao em tempo real com o preco do nosso motor.
  useEffect(() => {
    const prev = lastCandleRef.current
    if (last == null || !prev || !candleRef.current) return
    const step = INTERVAL_SECONDS[interval]
    const now = Math.floor(Date.now() / 1000)
    let next: Candle
    if (now < prev.time + step) {
      next = { ...prev, high: Math.max(prev.high, last), low: Math.min(prev.low, last), close: last }
    } else {
      const time = prev.time + Math.floor((now - prev.time) / step) * step
      next = { time, open: prev.close, high: Math.max(prev.close, last), low: Math.min(prev.close, last), close: last, volume: 0 }
    }
    lastCandleRef.current = next
    const time = next.time as UTCTimestamp
    candleRef.current.update({ ...next, time })
    lineRef.current?.update({ time, value: next.close })
  }, [last, interval])

  // Linhas de entrada, liquidacao, TP/SL e ordens pendentes do mercado atual.
  useEffect(() => {
    const series = candleRef.current
    if (!series) return
    for (const l of priceLinesRef.current) series.removePriceLine(l)
    priceLinesRef.current = []
    if (!showLines) return
    const add = (price: number | null | undefined, color: string, title: string, dashed = true) => {
      if (!price) return
      priceLinesRef.current.push(
        series.createPriceLine({
          price,
          color,
          title,
          lineWidth: 1,
          lineStyle: dashed ? LineStyle.Dashed : LineStyle.Solid,
          axisLabelVisible: true,
        }),
      )
    }
    for (const p of positions.filter((x) => x.symbol === market.symbol)) {
      add(p.entry_price, p.side === "long" ? COLORS.up : COLORS.down, `${p.side === "long" ? "Long" : "Short"} ${p.qty}`, false)
      add(p.liquidation_price, COLORS.accent, "Liq.")
      add(p.take_profit, COLORS.up, "TP")
      add(p.stop_loss, COLORS.down, "SL")
    }
    for (const o of openOrders.filter((x) => x.symbol === market.symbol)) {
      add(o.price ?? o.trigger_price, o.side === "buy" ? COLORS.up : COLORS.down, `${o.side === "buy" ? "Compra" : "Venda"} ${o.qty}`)
    }
  }, [positions, openOrders, market.symbol, showLines, candles])

  const shown = legend ?? lastCandleRef.current
  const d = market.priceDecimals
  const toolBtn = (active: boolean) =>
    cn("rounded px-1.5 py-0.5 text-xs font-medium transition-colors", active ? "text-primary" : "text-term-muted hover:text-term-text")

  return (
    <section aria-label="Gráfico" className="flex h-full flex-col bg-term-panel">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-term-line px-3 py-1.5">
        <div role="radiogroup" aria-label="Intervalo" className="flex items-center gap-0.5">
          {INTERVALS.map((i) => (
            <button key={i} role="radio" aria-checked={interval === i} onClick={() => setIntervalValue(i)} className={toolBtn(interval === i)}>
              {INTERVAL_LABEL[i]}
            </button>
          ))}
        </div>
        <span className="h-4 w-px bg-term-line" aria-hidden="true" />
        <div role="radiogroup" aria-label="Tipo de gráfico" className="flex items-center gap-0.5">
          <button role="radio" aria-checked={style === "candles"} onClick={() => setStyle("candles")} className={toolBtn(style === "candles")}>
            Velas
          </button>
          <button role="radio" aria-checked={style === "line"} onClick={() => setStyle("line")} className={toolBtn(style === "line")}>
            Linha
          </button>
        </div>
        <span className="h-4 w-px bg-term-line" aria-hidden="true" />
        {market.source === "binance" && (
          <button aria-pressed={showVolume} onClick={() => setShowVolume((v) => !v)} className={toolBtn(showVolume)}>
            Volume
          </button>
        )}
        <button aria-pressed={showLines} onClick={() => setShowLines((v) => !v)} className={toolBtn(showLines)}>
          Posições no gráfico
        </button>
        <button onClick={() => chartRef.current?.timeScale().fitContent()} className={toolBtn(false)}>
          Ajustar
        </button>
        <button onClick={() => chartRef.current?.timeScale().scrollToRealTime()} className={toolBtn(false)}>
          Tempo real
        </button>
      </div>

      <div className="relative min-h-0 flex-1">
        <div className="pointer-events-none absolute left-3 top-2 z-10 flex flex-wrap gap-x-2 font-mono text-[11px] text-term-muted">
          <span className="font-sans font-semibold text-term-text">
            {market.symbol} · {INTERVAL_LABEL[interval]}
          </span>
          {shown && (
            <>
              <span>
                A <span className={shown.close >= shown.open ? "text-long" : "text-short"}>{formatPrice(shown.open, d)}</span>
              </span>
              <span>
                M <span className={shown.close >= shown.open ? "text-long" : "text-short"}>{formatPrice(shown.high, d)}</span>
              </span>
              <span>
                m <span className={shown.close >= shown.open ? "text-long" : "text-short"}>{formatPrice(shown.low, d)}</span>
              </span>
              <span>
                F <span className={shown.close >= shown.open ? "text-long" : "text-short"}>{formatPrice(shown.close, d)}</span>
              </span>
            </>
          )}
        </div>
        {(isLoading || error) && (
          <p className="absolute inset-0 z-10 flex items-center justify-center text-xs text-term-muted">
            {error ? (error as Error).message : "Carregando gráfico..."}
          </p>
        )}
        <div ref={containerRef} className="h-full w-full" />
      </div>
    </section>
  )
}
