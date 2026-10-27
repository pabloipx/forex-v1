"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  CandlestickSeries,
  ColorType,
  createChart,
  HistogramSeries,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts"
import { CHART_THEMES, type TermTheme } from "@/lib/futures/term-theme"
import { buildCandles, TIMEFRAMES, type Candle, type PriceAnchor, type TimeframeId } from "@/lib/launch-candles"
import { cn } from "@/lib/utils"

const UP = "#089981"
const DOWN = "#f23645"
const VISIBLE_BARS = 70

export type PricePoint = PriceAnchor

const fmt = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function LaunchChart({
  points,
  symbol,
  theme,
  rally = false,
}: {
  points: PricePoint[]
  symbol: string
  theme: TermTheme
  rally?: boolean
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleRef = useRef<ISeriesApi<"Candlestick"> | null>(null)
  const volumeRef = useRef<ISeriesApi<"Histogram"> | null>(null)
  const framedRef = useRef<string | null>(null)
  const [tf, setTf] = useState<TimeframeId>("5m")
  const [hover, setHover] = useState<Candle | null>(null)
  const [tick, setTick] = useState(() => Math.floor(Date.now() / 1000))

  const interval = TIMEFRAMES.find((x) => x.id === tf)?.seconds ?? 300

  useEffect(() => {
    const id = setInterval(() => setTick(Math.floor(Date.now() / 1000)), 5000)
    return () => clearInterval(id)
  }, [])

  const candles = useMemo(() => buildCandles(points, symbol, interval, tick, rally), [points, symbol, interval, tick, rally])
  const byTime = useMemo(() => new Map(candles.map((c) => [c.time, c])), [candles])
  const byTimeRef = useRef(byTime)
  byTimeRef.current = byTime

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const t = CHART_THEMES[theme]
    const chart = createChart(el, {
      width: el.clientWidth,
      height: el.clientHeight,
      layout: {
        background: { type: ColorType.Solid, color: t.bg },
        textColor: t.text,
        fontSize: 11,
        attributionLogo: false,
      },
      grid: { vertLines: { color: t.grid }, horzLines: { color: t.grid } },
      rightPriceScale: { borderColor: t.border, scaleMargins: { top: 0.14, bottom: 0.22 } },
      timeScale: { borderColor: t.border, timeVisible: true, secondsVisible: false, rightOffset: 4, barSpacing: 7 },
      crosshair: {
        vertLine: { color: t.crosshair, style: LineStyle.LargeDashed, labelBackgroundColor: t.crosshairLabel },
        horzLine: { color: t.crosshair, style: LineStyle.LargeDashed, labelBackgroundColor: t.crosshairLabel },
      },
      handleScroll: { vertTouchDrag: false },
      localization: { locale: "pt-BR" },
    })
    chartRef.current = chart
    candleRef.current = chart.addSeries(CandlestickSeries, {
      upColor: UP,
      downColor: DOWN,
      borderUpColor: UP,
      borderDownColor: DOWN,
      wickUpColor: UP,
      wickDownColor: DOWN,
      priceFormat: { type: "price", precision: 2, minMove: 0.01 },
    })
    volumeRef.current = chart.addSeries(HistogramSeries, {
      priceScaleId: "volume",
      priceFormat: { type: "volume" },
      lastValueVisible: false,
      priceLineVisible: false,
    })
    chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } })

    chart.subscribeCrosshairMove((param) => {
      const time = typeof param.time === "number" ? param.time : null
      setHover(time != null && param.point ? (byTimeRef.current.get(time) ?? null) : null)
    })

    const ro = new ResizeObserver(([entry]) => {
      chart.applyOptions({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    ro.observe(el)
    framedRef.current = null
    return () => {
      ro.disconnect()
      chart.remove()
      chartRef.current = null
      candleRef.current = null
      volumeRef.current = null
    }
  }, [theme])

  useEffect(() => {
    const chart = chartRef.current
    if (!chart || !candleRef.current || !volumeRef.current) return
    candleRef.current.setData(
      candles.map((c) => ({ time: c.time as UTCTimestamp, open: c.open, high: c.high, low: c.low, close: c.close })),
    )
    volumeRef.current.setData(
      candles.map((c) => ({
        time: c.time as UTCTimestamp,
        value: c.volume,
        color: c.close >= c.open ? `${UP}55` : `${DOWN}55`,
      })),
    )
    const key = `${theme}:${tf}`
    if (framedRef.current !== key && candles.length > 0) {
      framedRef.current = key
      chart.timeScale().setVisibleLogicalRange({ from: candles.length - VISIBLE_BARS, to: candles.length + 3 })
    }
  }, [candles, theme, tf])

  const shown = hover ?? candles[candles.length - 1]
  const shownUp = shown ? shown.close >= shown.open : true
  const shownChange = shown ? ((shown.close - shown.open) / shown.open) * 100 : 0

  return (
    <div className="flex size-full flex-col">
      <div className="flex items-center gap-1 border-b border-term-line px-2 py-1.5" role="tablist" aria-label="Tempo gráfico">
        {TIMEFRAMES.map((x) => (
          <button
            key={x.id}
            type="button"
            role="tab"
            aria-selected={tf === x.id}
            onClick={() => setTf(x.id)}
            className={cn(
              "h-8 min-w-11 rounded px-2 font-mono text-xs font-medium transition-colors",
              tf === x.id ? "bg-term-line text-term-text" : "text-term-muted hover:text-term-text",
            )}
          >
            {x.label}
          </button>
        ))}
      </div>
      <div className="relative min-h-0 flex-1">
        <div ref={containerRef} className="absolute inset-0" />
        {shown && (
          <div className="pointer-events-none absolute left-2 top-1.5 z-[1] flex flex-wrap gap-x-2.5 gap-y-0.5 font-mono text-[11px] tabular-nums text-term-muted">
            <span>
              O <span className={shownUp ? "text-term-up" : "text-term-down"}>{fmt(shown.open)}</span>
            </span>
            <span>
              H <span className={shownUp ? "text-term-up" : "text-term-down"}>{fmt(shown.high)}</span>
            </span>
            <span>
              L <span className={shownUp ? "text-term-up" : "text-term-down"}>{fmt(shown.low)}</span>
            </span>
            <span>
              C <span className={shownUp ? "text-term-up" : "text-term-down"}>{fmt(shown.close)}</span>
            </span>
            <span className={shownUp ? "text-term-up" : "text-term-down"}>
              {shownChange >= 0 ? "+" : ""}
              {shownChange.toFixed(2)}%
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
