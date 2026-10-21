"use client"

import { useEffect, useRef, useState, type MutableRefObject } from "react"
import {
  HistogramSeries,
  LineSeries,
  LineStyle,
  createSeriesMarkers,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts"
import type { Candle } from "@/lib/futures/chart-intervals"
import type { ChartScript } from "@/hooks/use-chart-scripts"
import { runScript, type ScriptOutput, type ScriptPanel } from "@/lib/futures/script-runtime"

type AnySeries = ISeriesApi<"Line"> | ISeriesApi<"Histogram">

interface Options {
  chart: IChartApi | null
  getMain: () => ISeriesApi<"Candlestick"> | null
  barsRef: MutableRefObject<Candle[]>
  scripts: ChartScript[]
  dataVersion: unknown
  decimals: number
}

const REFRESH_MS = 2000

export function useScriptOverlay({ chart, getMain, barsRef, scripts, dataVersion, decimals }: Options) {
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [panels, setPanels] = useState<ScriptPanel[]>([])
  const hlineSigRef = useRef("")
  const markerSigRef = useRef("")
  const plotSigRef = useRef<string[]>([])
  const seriesRef = useRef<{ key: string; series: AnySeries }[]>([])
  const layoutRef = useRef("")
  const linesRef = useRef<{ series: AnySeries | ISeriesApi<"Candlestick">; line: IPriceLine }[]>([])
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null)
  const runIdRef = useRef(0)
  const lastSigRef = useRef("")

  const active = scripts.filter((s) => s.enabled)
  const scriptsSig = JSON.stringify(active.map((s) => [s.id, s.code]))

  useEffect(() => {
    if (!chart) return
    const main = getMain()
    if (!main) return
    markersRef.current = createSeriesMarkers(main, [])

    return () => {
      for (const { series, line } of linesRef.current) {
        try {
          series.removePriceLine(line)
        } catch {}
      }
      for (const { series } of seriesRef.current) {
        try {
          chart.removeSeries(series)
        } catch {}
      }
      try {
        markersRef.current?.detach()
      } catch {}
      linesRef.current = []
      seriesRef.current = []
      layoutRef.current = ""
      hlineSigRef.current = ""
      markerSigRef.current = ""
      plotSigRef.current = []
      markersRef.current = null
    }
  }, [chart, getMain])

  useEffect(() => {
    if (!chart) return
    const list: ChartScript[] = JSON.parse(scriptsSig).map(([id, code]: [string, string]) => ({ id, code }))
    lastSigRef.current = ""

    const render = (results: { id: string; output: ScriptOutput }[], bars: Candle[]) => {
      const main = getMain()
      if (!main) return
      const fmt = { type: "price" as const, precision: decimals, minMove: 10 ** -decimals }

      let nextPane = 1
      const paneOf = new Map<string, number>()
      const keys: { key: string; scriptId: string; idx: number; pane: number }[] = []
      for (const { id, output } of results) {
        output.plots.forEach((p, idx) => {
          let pane = 0
          if (p.pane === "separate") {
            if (!paneOf.has(id)) paneOf.set(id, nextPane++)
            pane = paneOf.get(id)!
          }
          keys.push({ key: `${id}:${idx}:${p.type}:${pane}`, scriptId: id, idx, pane })
        })
      }

      const layout = keys.map((k) => k.key).join("|")
      if (layout !== layoutRef.current) {
        for (const { series, line } of linesRef.current) {
          try {
            series.removePriceLine(line)
          } catch {}
        }
        linesRef.current = []
        hlineSigRef.current = ""
        plotSigRef.current = []
        for (const { series } of seriesRef.current) chart.removeSeries(series)
        seriesRef.current = []
        layoutRef.current = layout
        for (const k of keys) {
          const plot = results.find((r) => r.id === k.scriptId)!.output.plots[k.idx]
          const common = { color: plot.color, title: plot.title, priceLineVisible: false, lastValueVisible: true, priceFormat: fmt }
          const series =
            plot.type === "histogram"
              ? chart.addSeries(HistogramSeries, common, k.pane)
              : chart.addSeries(LineSeries, { ...common, lineWidth: plot.width as 1 | 2 | 3 | 4, crosshairMarkerVisible: false }, k.pane)
          seriesRef.current.push({ key: k.key, series })
        }
        if (paneOf.size) {
          const panes = chart.panes()
          for (let i = 1; i < panes.length; i++) panes[i].setHeight(110)
        }
      }

      const firstTime = bars[0]?.time ?? 0
      keys.forEach((k, i) => {
        const plot = results.find((r) => r.id === k.scriptId)!.output.plots[k.idx]
        const target = seriesRef.current[i]?.series
        if (!target) return
        // Só o miolo muda raramente; comparar o início + os 3 últimos valores evita setData completo a cada tick.
        const head = `${plot.color}|${plot.title}|${firstTime}|${bars.length}`
        const tail = plot.data.slice(-3).join(",")
        const prev = plotSigRef.current[i]
        if (prev === `${head}|${tail}`) return
        if (prev && prev.startsWith(head + "|") && bars.length > 0) {
          const j = bars.length - 1
          const v = plot.data[j]
          const t = bars[j].time as UTCTimestamp
          target.update(v != null ? { time: t, value: v } : { time: t })
          plotSigRef.current[i] = `${head}|${tail}`
          return
        }
        target.applyOptions({ color: plot.color, title: plot.title })
        const data = []
        for (let j = 0; j < bars.length; j++) {
          const v = plot.data[j]
          const t = bars[j].time as UTCTimestamp
          data.push(v != null ? { time: t, value: v } : { time: t })
        }
        target.setData(data)
        plotSigRef.current[i] = `${head}|${tail}`
      })

      const hlineSig = JSON.stringify(results.map((r) => [r.id, r.output.hlines]))
      const rebuildLines = hlineSig !== hlineSigRef.current
      if (rebuildLines) {
        for (const { series, line } of linesRef.current) {
          try {
            series.removePriceLine(line)
          } catch {}
        }
        linesRef.current = []
        hlineSigRef.current = hlineSig
      }

      const markers: SeriesMarker<Time>[] = []
      for (const { id, output } of results) {
        for (const h of rebuildLines ? output.hlines : []) {
          let host: AnySeries | ISeriesApi<"Candlestick"> = main
          if (h.pane === "separate") {
            const pane = paneOf.get(id)
            const idx = keys.findIndex((k) => k.scriptId === id && k.pane === pane)
            if (idx >= 0) host = seriesRef.current[idx].series
          }
          const line = host.createPriceLine({
            price: h.price,
            color: h.color,
            title: h.title,
            lineWidth: 1,
            lineStyle: LineStyle.Dotted,
            axisLabelVisible: true,
          })
          linesRef.current.push({ series: host, line })
        }
        for (const m of output.markers) {
          const bar = bars[m.index]
          if (!bar) continue
          const time = bar.time as UTCTimestamp
          if (m.position === "price" && m.price != null) {
            markers.push({ time, position: "atPriceMiddle", price: m.price, color: m.color, shape: m.shape, text: m.text, size: 0.6 })
          } else {
            markers.push({
              time,
              position: m.position === "above" ? "aboveBar" : "belowBar",
              color: m.color,
              shape: m.shape,
              text: m.text,
            })
          }
        }
      }
      markers.sort((a, b) => (a.time as number) - (b.time as number))
      const markerSig = `${markers.length}:${markers.at(-1)?.time}:${markers.at(-1)?.text}:${firstTime}`
      if (markerSig !== markerSigRef.current) {
        markerSigRef.current = markerSig
        markersRef.current?.setMarkers(markers)
      }

      const nextPanels = results.flatMap((r) => r.output.panels ?? [])
      setPanels((prev) => (JSON.stringify(prev) === JSON.stringify(nextPanels) ? prev : nextPanels))
    }

    const tick = async () => {
      const bars = barsRef.current
      const last = bars.at(-1)
      const sig = `${bars.length}:${last?.time}:${last?.close}`
      if (sig === lastSigRef.current) return
      lastSigRef.current = sig
      const runId = ++runIdRef.current
      const snapshot = bars.map((b) => ({ time: b.time, open: b.open, high: b.high, low: b.low, close: b.close, volume: b.volume }))
      const results = snapshot.length
        ? await Promise.all(list.map(async (s) => ({ id: s.id, res: await runScript(s.code, snapshot) })))
        : []
      if (runId !== runIdRef.current) return

      const nextErrors: Record<string, string> = {}
      const ok: { id: string; output: ScriptOutput }[] = []
      for (const r of results) {
        if (r.res.ok) ok.push({ id: r.id, output: r.res.output })
        else nextErrors[r.id] = r.res.error
      }
      setErrors((prev) => (JSON.stringify(prev) === JSON.stringify(nextErrors) ? prev : nextErrors))
      render(ok, snapshot)
    }

    tick()
    const timer = setInterval(tick, REFRESH_MS)
    return () => {
      clearInterval(timer)
      runIdRef.current++
    }
  }, [chart, getMain, barsRef, scriptsSig, dataVersion, decimals])

  useEffect(() => {
    if (scriptsSig === "[]") setPanels([])
  }, [scriptsSig])

  return { errors, panels }
}
