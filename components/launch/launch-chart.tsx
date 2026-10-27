"use client"

import { useEffect, useRef } from "react"
import { AreaSeries, ColorType, createChart, LineStyle, type IChartApi, type ISeriesApi, type UTCTimestamp } from "lightweight-charts"
import { CHART_THEMES, type TermTheme } from "@/lib/futures/term-theme"

const UP = "#089981"
const DOWN = "#f23645"

export interface PricePoint {
  time: number
  value: number
}

export function LaunchChart({ points, theme, rising }: { points: PricePoint[]; theme: TermTheme; rising: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null)

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
      rightPriceScale: { borderColor: t.border, scaleMargins: { top: 0.15, bottom: 0.1 } },
      timeScale: { borderColor: t.border, timeVisible: true, secondsVisible: false },
      crosshair: {
        vertLine: { color: t.crosshair, style: LineStyle.LargeDashed, labelBackgroundColor: t.crosshairLabel },
        horzLine: { color: t.crosshair, style: LineStyle.LargeDashed, labelBackgroundColor: t.crosshairLabel },
      },
      handleScroll: { vertTouchDrag: false },
      localization: { locale: "pt-BR" },
    })
    chartRef.current = chart
    seriesRef.current = chart.addSeries(AreaSeries, {
      lineWidth: 2,
      priceFormat: { type: "price", precision: 2, minMove: 0.01 },
    })
    const ro = new ResizeObserver(([entry]) => {
      chart.applyOptions({ width: entry.contentRect.width, height: entry.contentRect.height })
    })
    ro.observe(el)
    return () => {
      ro.disconnect()
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
    }
  }, [theme])

  useEffect(() => {
    const series = seriesRef.current
    if (!series) return
    const color = rising ? UP : DOWN
    series.applyOptions({ lineColor: color, topColor: `${color}55`, bottomColor: `${color}05` })
    series.setData(points.map((p) => ({ time: p.time as UTCTimestamp, value: p.value })))
    chartRef.current?.timeScale().fitContent()
  }, [points, rising, theme])

  return <div ref={containerRef} className="size-full" />
}
