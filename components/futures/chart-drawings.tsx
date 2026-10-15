"use client"

import { useCallback, useEffect, useRef, useState, type MutableRefObject, type PointerEvent as ReactPointerEvent } from "react"
import type { IChartApi, ISeriesApi, Logical, SeriesType } from "lightweight-charts"
import {
  ChartNoAxesGantt,
  Eye,
  EyeOff,
  Lock,
  LockOpen,
  Magnet,
  Minus,
  MousePointer2,
  MoveUpRight,
  Ruler,
  SeparatorVertical,
  Slash,
  Square,
  Trash2,
  Type,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { formatPrice } from "@/lib/futures/markets"
import type { Candle } from "@/lib/futures/chart-intervals"

export type DrawTool = "cursor" | "trend" | "ray" | "hline" | "vline" | "rect" | "fib" | "measure" | "text"
type ShapeType = Exclude<DrawTool, "cursor">

interface Pt {
  t: number
  p: number
}

interface Drawing {
  id: string
  type: ShapeType
  pts: Pt[]
  color: string
  text?: string
}

const SINGLE_CLICK: ShapeType[] = ["hline", "vline", "text"]
const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]
const SWATCHES = ["#2190ff", "#089981", "#f23645", "#e6e9f0"]
const STORAGE_PREFIX = "fx-drawings:"

export const TOOLS: { id: DrawTool; label: string; icon: LucideIcon }[] = [
  { id: "cursor", label: "Cursor", icon: MousePointer2 },
  { id: "trend", label: "Linha de tendência", icon: Slash },
  { id: "ray", label: "Raio", icon: MoveUpRight },
  { id: "hline", label: "Linha horizontal", icon: Minus },
  { id: "vline", label: "Linha vertical", icon: SeparatorVertical },
  { id: "rect", label: "Retângulo", icon: Square },
  { id: "fib", label: "Retração de Fibonacci", icon: ChartNoAxesGantt },
  { id: "measure", label: "Régua (medir preço e tempo)", icon: Ruler },
  { id: "text", label: "Texto", icon: Type },
]

function loadDrawings(symbol: string): Drawing[] {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + symbol)
    return raw ? (JSON.parse(raw) as Drawing[]) : []
  } catch {
    return []
  }
}

export interface DrawingState {
  tool: DrawTool
  setTool: (t: DrawTool) => void
  magnet: boolean
  setMagnet: (v: boolean) => void
  locked: boolean
  setLocked: (v: boolean) => void
  hidden: boolean
  setHidden: (v: boolean) => void
  drawings: Drawing[]
  setDrawings: (fn: (d: Drawing[]) => Drawing[]) => void
  selected: string | null
  setSelected: (id: string | null) => void
}

export function useDrawingState(symbol: string): DrawingState {
  const [tool, setTool] = useState<DrawTool>("cursor")
  const [magnet, setMagnet] = useState(false)
  const [locked, setLocked] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [store, setStore] = useState<{ symbol: string; items: Drawing[] }>({ symbol: "", items: [] })

  useEffect(() => {
    setStore({ symbol, items: loadDrawings(symbol) })
    setSelected(null)
  }, [symbol])

  const setDrawings = useCallback(
    (fn: (d: Drawing[]) => Drawing[]) =>
      setStore((s) => {
        const items = fn(s.items)
        try {
          localStorage.setItem(STORAGE_PREFIX + s.symbol, JSON.stringify(items))
        } catch {}
        return { ...s, items }
      }),
    [],
  )

  return {
    tool,
    setTool,
    magnet,
    setMagnet,
    locked,
    setLocked,
    hidden,
    setHidden,
    drawings: store.symbol === symbol ? store.items : [],
    setDrawings,
    selected,
    setSelected,
  }
}

function SideButton({
  label,
  active,
  onClick,
  icon: Icon,
  danger,
}: {
  label: string
  active?: boolean
  onClick: () => void
  icon: LucideIcon
  danger?: boolean
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded transition-colors",
        active ? "bg-term-line text-primary" : danger ? "text-term-muted hover:text-short" : "text-term-muted hover:bg-term-line/60 hover:text-term-text",
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
    </button>
  )
}

export function DrawingToolbar({ state }: { state: DrawingState }) {
  const { tool, setTool, magnet, setMagnet, locked, setLocked, hidden, setHidden, drawings, setDrawings, setSelected } = state
  const [confirmClear, setConfirmClear] = useState(false)
  useEffect(() => {
    if (!confirmClear) return
    const t = setTimeout(() => setConfirmClear(false), 3000)
    return () => clearTimeout(t)
  }, [confirmClear])
  return (
    <div
      role="toolbar"
      aria-label="Ferramentas de desenho"
      aria-orientation="vertical"
      className="flex w-9 shrink-0 flex-col items-center gap-0.5 overflow-y-auto border-r border-term-line py-1.5 [scrollbar-width:none]"
    >
      {TOOLS.map((t) => (
        <SideButton key={t.id} label={t.label} icon={t.icon} active={tool === t.id} onClick={() => setTool(tool === t.id ? "cursor" : t.id)} />
      ))}
      <span className="my-1 h-px w-5 shrink-0 bg-term-line" aria-hidden="true" />
      <SideButton label="Modo ímã (prende no OHLC)" icon={Magnet} active={magnet} onClick={() => setMagnet(!magnet)} />
      <SideButton label={locked ? "Destravar desenhos" : "Travar desenhos"} icon={locked ? Lock : LockOpen} active={locked} onClick={() => setLocked(!locked)} />
      <SideButton label={hidden ? "Mostrar desenhos" : "Ocultar desenhos"} icon={hidden ? EyeOff : Eye} active={hidden} onClick={() => setHidden(!hidden)} />
      <SideButton
        label={confirmClear ? `Clique de novo para remover ${drawings.length} desenho(s)` : "Remover todos os desenhos"}
        icon={Trash2}
        danger
        active={confirmClear}
        onClick={() => {
          if (!drawings.length) return
          if (!confirmClear) {
            setConfirmClear(true)
            return
          }
          setDrawings(() => [])
          setSelected(null)
          setConfirmClear(false)
        }}
      />
    </div>
  )
}

interface LayerProps {
  state: DrawingState
  chart: IChartApi
  getSeries: () => ISeriesApi<SeriesType> | null
  barsRef: MutableRefObject<Candle[]>
  step: number
  decimals: number
}

type Drag = { id: string; handle: number | "body"; start: Pt; orig: Pt[] }

export function DrawingLayer({ state, chart, getSeries, barsRef, step, decimals }: LayerProps) {
  const { tool, setTool, magnet, locked, hidden, drawings, setDrawings, selected, setSelected } = state
  const svgRef = useRef<SVGSVGElement>(null)
  const [, setVersion] = useState(0)
  const [draft, setDraft] = useState<Drawing | null>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [textEdit, setTextEdit] = useState<{ id?: string; pt: Pt; value: string } | null>(null)

  const commitText = () => {
    if (!textEdit) return
    const text = textEdit.value.trim()
    if (textEdit.id) {
      const id = textEdit.id
      setDrawings((all) => (text ? all.map((x) => (x.id === id ? { ...x, text } : x)) : all.filter((x) => x.id !== id)))
    } else if (text) {
      const d: Drawing = { id: crypto.randomUUID(), type: "text", pts: [textEdit.pt], color: SWATCHES[0], text }
      setDrawings((all) => [...all, d])
      setSelected(d.id)
    }
    setTextEdit(null)
  }

  const timeToLogical = (t: number): number | null => {
    const bars = barsRef.current
    const n = bars.length
    if (!n) return null
    const first = bars[0].time
    const last = bars[n - 1].time
    if (t <= first) return (t - first) / step
    if (t >= last) return n - 1 + (t - last) / step
    let lo = 0
    let hi = n - 1
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (bars[mid].time <= t) lo = mid
      else hi = mid
    }
    return lo + (t - bars[lo].time) / (bars[hi].time - bars[lo].time)
  }

  const logicalToTime = (l: number): number | null => {
    const bars = barsRef.current
    const n = bars.length
    if (!n) return null
    if (l <= 0) return bars[0].time + l * step
    if (l >= n - 1) return bars[n - 1].time + (l - (n - 1)) * step
    const i = Math.floor(l)
    return bars[i].time + (l - i) * (bars[i + 1].time - bars[i].time)
  }

  const toX = (t: number) => {
    const l = timeToLogical(t)
    return l == null ? null : chart.timeScale().logicalToCoordinate(l as Logical)
  }
  const toY = (p: number) => getSeries()?.priceToCoordinate(p) ?? null

  const eventPoint = (e: ReactPointerEvent, snap: boolean): Pt | null => {
    const rect = svgRef.current?.getBoundingClientRect()
    const series = getSeries()
    if (!rect || !series) return null
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const l = chart.timeScale().coordinateToLogical(x)
    const price = series.coordinateToPrice(y)
    if (l == null || price == null) return null
    if (snap && magnet) {
      const bars = barsRef.current
      const bar = bars[Math.max(0, Math.min(bars.length - 1, Math.round(l)))]
      if (bar) {
        const nearest = [bar.open, bar.high, bar.low, bar.close].reduce((a, b) => (Math.abs(b - price) < Math.abs(a - price) ? b : a))
        return { t: bar.time, p: nearest }
      }
    }
    const t = logicalToTime(l)
    return t == null ? null : { t, p: price }
  }

  // Escala de preco/tempo muda sem evento (autoescala, arraste no eixo): compara uma assinatura barata por frame.
  const active = drawings.length > 0 || !!draft
  useEffect(() => {
    if (!active) return
    let sig = ""
    let raf = 0
    const loop = () => {
      const series = getSeries()
      const ts = chart.timeScale()
      const range = ts.getVisibleLogicalRange()
      const ref = barsRef.current.at(-1)?.close ?? 0
      const next = `${range?.from}|${range?.to}|${ts.width()}|${series?.priceToCoordinate(ref)}|${series?.priceToCoordinate(ref * 1.01)}|${svgRef.current?.clientHeight}`
      if (next !== sig) {
        sig = next
        setVersion((v) => v + 1)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [active, chart, getSeries, barsRef])

  useEffect(() => {
    const onClick = () => setSelected(null)
    chart.subscribeClick(onClick)
    return () => chart.unsubscribeClick(onClick)
  }, [chart, setSelected])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.closest("input, textarea, select, [contenteditable]")) return
      if (e.key === "Escape") {
        setDraft(null)
        setTool("cursor")
        setSelected(null)
      } else if ((e.key === "Delete" || e.key === "Backspace") && selected) {
        e.preventDefault()
        setDrawings((d) => d.filter((x) => x.id !== selected))
        setSelected(null)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [selected, setDrawings, setSelected, setTool])

  useEffect(() => {
    if (tool === "cursor") setDraft(null)
  }, [tool])

  const color = SWATCHES[0]

  const onSvgPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (tool === "cursor" || locked) return
    const pt = eventPoint(e, true)
    if (!pt) return
    const type = tool as ShapeType
    if (SINGLE_CLICK.includes(type)) {
      if (type === "text") {
        e.preventDefault()
        setTextEdit({ pt, value: "" })
        setTool("cursor")
        return
      }
      const d: Drawing = { id: crypto.randomUUID(), type, pts: [pt], color }
      setDrawings((all) => [...all, d])
      setSelected(d.id)
      setTool("cursor")
      return
    }
    if (!draft) {
      setDraft({ id: crypto.randomUUID(), type, pts: [pt, pt], color })
      return
    }
    const done = { ...draft, pts: [draft.pts[0], pt] }
    setDraft(null)
    setDrawings((all) => [...all, done])
    setSelected(done.id)
    setTool("cursor")
  }

  const onSvgPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (draft) {
      const pt = eventPoint(e, true)
      if (pt) setDraft({ ...draft, pts: [draft.pts[0], pt] })
      return
    }
    if (!drag) return
    const pt = eventPoint(e, drag.handle !== "body")
    if (!pt) return
    setDrawings((all) =>
      all.map((d) => {
        if (d.id !== drag.id) return d
        if (drag.handle === "body") {
          const dt = pt.t - drag.start.t
          const dp = pt.p - drag.start.p
          return { ...d, pts: drag.orig.map((o) => ({ t: o.t + dt, p: o.p + dp })) }
        }
        const pts = [...drag.orig]
        pts[drag.handle] = pt
        return { ...d, pts }
      }),
    )
  }

  const endDrag = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!drag) return
    svgRef.current?.releasePointerCapture(e.pointerId)
    setDrag(null)
  }

  const startDrag = (e: ReactPointerEvent, d: Drawing, handle: number | "body") => {
    if (locked || tool !== "cursor") return
    e.stopPropagation()
    setSelected(d.id)
    const start = eventPoint(e, false)
    if (!start) return
    svgRef.current?.setPointerCapture(e.pointerId)
    setDrag({ id: d.id, handle, start, orig: d.pts })
  }

  const recolor = (c: string) => setDrawings((all) => all.map((d) => (d.id === selected ? { ...d, color: c } : d)))
  const removeSelected = () => {
    setDrawings((all) => all.filter((d) => d.id !== selected))
    setSelected(null)
  }

  const paneW = chart.timeScale().width()
  const paneH = Math.max(0, (svgRef.current?.clientHeight ?? 0) - chart.timeScale().height())
  const interactive = !locked && tool === "cursor" && !drag
  const shapePE = interactive ? "auto" : "none"
  const capture = (tool !== "cursor" && !locked) || !!drag

  const renderShape = (d: Drawing, isDraft = false) => {
    const xs = d.pts.map((p) => toX(p.t))
    const ys = d.pts.map((p) => toY(p.p))
    if (xs.some((x) => x == null) || ys.some((y) => y == null)) return null
    const [x1, x2 = x1] = xs as number[]
    const [y1, y2 = y1] = ys as number[]
    const isSel = selected === d.id && !isDraft
    const stroke = d.color
    const sw = isSel ? 2 : 1.5
    const hit = { pointerEvents: shapePE as "auto" | "none", cursor: interactive ? "move" : undefined }
    const bodyDown = (e: ReactPointerEvent) => startDrag(e, d, "body")
    const fmt = (v: number) => formatPrice(v, decimals)
    const els: React.ReactNode[] = []

    if (d.type === "trend" || d.type === "ray") {
      let ex = x2
      let ey = y2
      if (d.type === "ray" && (x2 !== x1 || y2 !== y1)) {
        const dx = x2 - x1
        const dy = y2 - y1
        const k = dx === 0 ? (dy > 0 ? paneH - y1 : -y1) / (dy || 1) : ((dx > 0 ? paneW : 0) - x1) / dx
        ex = x1 + dx * Math.max(k, 1)
        ey = y1 + dy * Math.max(k, 1)
      }
      els.push(<line key="l" x1={x1} y1={y1} x2={ex} y2={ey} stroke={stroke} strokeWidth={sw} />)
      els.push(<line key="h" x1={x1} y1={y1} x2={ex} y2={ey} stroke="transparent" strokeWidth={10} style={hit} onPointerDown={bodyDown} />)
    } else if (d.type === "hline") {
      els.push(<line key="l" x1={0} y1={y1} x2={paneW} y2={y1} stroke={stroke} strokeWidth={sw} />)
      els.push(<line key="h" x1={0} y1={y1} x2={paneW} y2={y1} stroke="transparent" strokeWidth={10} style={hit} onPointerDown={bodyDown} />)
      els.push(
        <g key="lbl" transform={`translate(${paneW - 4}, ${y1 - 4})`}>
          <text textAnchor="end" fontSize={10} fill={stroke} className="font-mono">
            {fmt(d.pts[0].p)}
          </text>
        </g>,
      )
    } else if (d.type === "vline") {
      els.push(<line key="l" x1={x1} y1={0} x2={x1} y2={paneH} stroke={stroke} strokeWidth={sw} />)
      els.push(<line key="h" x1={x1} y1={0} x2={x1} y2={paneH} stroke="transparent" strokeWidth={10} style={hit} onPointerDown={bodyDown} />)
    } else if (d.type === "rect" || d.type === "measure") {
      const rx = Math.min(x1, x2)
      const ry = Math.min(y1, y2)
      const w = Math.abs(x2 - x1)
      const h = Math.abs(y2 - y1)
      const measureUp = d.pts[1].p >= d.pts[0].p
      const fill = d.type === "measure" ? (measureUp ? "#089981" : "#f23645") : stroke
      els.push(
        <rect
          key="r"
          x={rx}
          y={ry}
          width={w}
          height={h}
          fill={fill}
          fillOpacity={0.12}
          stroke={fill}
          strokeWidth={sw}
          style={hit}
          onPointerDown={bodyDown}
        />,
      )
      if (d.type === "measure") {
        const dp = d.pts[1].p - d.pts[0].p
        const pct = d.pts[0].p ? (dp / d.pts[0].p) * 100 : 0
        const l1 = timeToLogical(d.pts[0].t) ?? 0
        const l2 = timeToLogical(d.pts[1].t) ?? 0
        const bars = Math.round(Math.abs(l2 - l1))
        const label = `${dp >= 0 ? "+" : ""}${fmt(dp)} (${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%) · ${bars} barras`
        const ly = measureUp ? ry - 8 : ry + h + 16
        els.push(
          <g key="m" pointerEvents="none">
            <rect x={rx + w / 2 - label.length * 3.1 - 6} y={ly - 12} width={label.length * 6.2 + 12} height={17} rx={3} fill={fill} />
            <text x={rx + w / 2} y={ly} textAnchor="middle" fontSize={10} fill="#0b0e11" className="font-mono font-semibold">
              {label}
            </text>
          </g>,
        )
      }
    } else if (d.type === "fib") {
      const p0 = d.pts[0].p
      const p1 = d.pts[1].p
      const left = Math.min(x1, x2)
      FIB_LEVELS.forEach((lvl) => {
        const price = p1 + (p0 - p1) * lvl
        const y = toY(price)
        if (y == null) return
        els.push(<line key={`f${lvl}`} x1={left} y1={y} x2={paneW} y2={y} stroke={stroke} strokeWidth={1} strokeOpacity={lvl === 0 || lvl === 1 ? 1 : 0.7} />)
        els.push(
          <text key={`t${lvl}`} x={left + 4} y={y - 3} fontSize={10} fill={stroke} className="font-mono" pointerEvents="none">
            {`${lvl} (${fmt(price)})`}
          </text>,
        )
      })
      els.push(<line key="diag" x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth={1} strokeDasharray="4 3" />)
      els.push(
        <rect
          key="h"
          x={left}
          y={Math.min(y1, y2)}
          width={Math.max(8, paneW - left)}
          height={Math.max(8, Math.abs(y2 - y1))}
          fill="transparent"
          style={hit}
          onPointerDown={bodyDown}
        />,
      )
    } else if (d.type === "text") {
      els.push(
        <text
          key="t"
          x={x1}
          y={y1}
          fontSize={12}
          fill={stroke}
          className="select-none font-sans font-medium"
          style={hit}
          onPointerDown={bodyDown}
          onDoubleClick={() => setTextEdit({ id: d.id, pt: d.pts[0], value: d.text ?? "" })}
        >
          {d.text}
        </text>,
      )
    }

    if (isSel && !locked) {
      const handles = d.type === "hline" || d.type === "vline" || d.type === "text" ? [] : xs.map((x, i) => ({ x: x as number, y: ys[i] as number, i }))
      for (const h of handles) {
        els.push(
          <circle
            key={`hd${h.i}`}
            cx={h.x}
            cy={h.y}
            r={5}
            fill="#15181d"
            stroke={stroke}
            strokeWidth={2}
            style={{ pointerEvents: shapePE as "auto" | "none", cursor: "grab" }}
            onPointerDown={(e) => startDrag(e, d, h.i)}
          />,
        )
      }
    }
    return (
      <g key={d.id} opacity={isDraft ? 0.85 : 1}>
        {els}
      </g>
    )
  }

  const selectedDrawing = drawings.find((d) => d.id === selected)

  return (
    <>
      <svg
        ref={svgRef}
        className="absolute inset-0 z-[5] h-full w-full"
        style={{ pointerEvents: capture ? "auto" : "none", cursor: tool !== "cursor" && !locked ? "crosshair" : undefined, touchAction: capture ? "none" : undefined }}
        onPointerDown={onSvgPointerDown}
        onPointerMove={onSvgPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        aria-hidden="true"
      >
        <defs>
          <clipPath id="fx-pane-clip">
            <rect x={0} y={0} width={paneW} height={paneH} />
          </clipPath>
        </defs>
        <g clipPath="url(#fx-pane-clip)">
          {!hidden && drawings.map((d) => renderShape(d))}
          {draft && renderShape(draft, true)}
        </g>
      </svg>

      {textEdit &&
        (() => {
          const x = toX(textEdit.pt.t)
          const y = toY(textEdit.pt.p)
          if (x == null || y == null) return null
          return (
            <input
              autoFocus
              aria-label="Texto da anotação"
              placeholder="Digite e pressione Enter"
              value={textEdit.value}
              maxLength={120}
              onChange={(e) => setTextEdit((s) => (s ? { ...s, value: e.target.value } : s))}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (e.nativeEvent.isComposing || e.keyCode === 229) return
                  e.preventDefault()
                  commitText()
                } else if (e.key === "Escape") {
                  e.stopPropagation()
                  setTextEdit(null)
                }
              }}
              onBlur={commitText}
              className="absolute z-20 h-7 w-48 -translate-y-full rounded border border-primary bg-term-panel px-2 text-xs text-term-text outline-none"
              style={{ left: x, top: y }}
            />
          )
        })()}

      {tool !== "cursor" && !locked && (
        <p className="pointer-events-none absolute bottom-8 left-1/2 z-10 -translate-x-1/2 rounded bg-term-bg/90 px-2 py-1 text-[11px] text-term-muted">
          {SINGLE_CLICK.includes(tool as ShapeType)
            ? "Clique no gráfico para posicionar · Esc cancela"
            : draft
              ? "Clique para definir o segundo ponto"
              : "Clique para definir o primeiro ponto · Esc cancela"}
        </p>
      )}

      {selectedDrawing && !locked && !hidden && (
        <div className="absolute left-1/2 top-8 z-10 flex -translate-x-1/2 items-center gap-1 rounded-md border border-term-line bg-term-panel px-1.5 py-1 shadow-lg">
          {SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Cor ${c}`}
              onClick={() => recolor(c)}
              className={cn("size-4 rounded-full border", selectedDrawing.color === c ? "border-term-text" : "border-transparent")}
              style={{ backgroundColor: c }}
            />
          ))}
          <span className="mx-0.5 h-4 w-px bg-term-line" aria-hidden="true" />
          <button type="button" aria-label="Remover desenho" onClick={removeSelected} className="flex size-5 items-center justify-center text-term-muted hover:text-short">
            <Trash2 className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      )}
    </>
  )
}
