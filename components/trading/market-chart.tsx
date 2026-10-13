"use client"

import React, { memo, useEffect, useMemo, useRef, useState } from "react"
import { OTC_ASSETS, multiAssetEngine } from "@/lib/price-engine/multi-asset-engine"
import { isRealSymbol } from "@/lib/price-engine/real-price-store"
import { getBars, subscribeBars, unsubscribeBars } from "@/lib/price-engine/datafeed"

// Mapa central de casas decimais por simbolo (fonte unica: engine de precos)
const SYMBOL_DECIMALS: Record<string, number> = Object.fromEntries(
  OTC_ASSETS.map((a) => [a.symbol, a.decimals]),
)

// Retorna as casas decimais corretas para um simbolo.
// Fallback inteligente por magnitude do preco para simbolos desconhecidos.
function getDecimals(sym: string, price?: number): number {
  if (SYMBOL_DECIMALS[sym] != null) return SYMBOL_DECIMALS[sym]
  if (price != null && price > 0) {
    if (price < 0.001) return 8
    if (price < 1) return 5
    if (price < 1000) return price < 10 ? 4 : 2
    return 2
  }
  if (sym.includes("JPY")) return 3
  return 5
}

// ========== ERROR BOUNDARY ==========
class ChartErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError() {
    return { hasError: true }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: "#0d0d0f" }}>
          <span className="text-[#787B86] text-xs">Erro ao carregar grafico</span>
        </div>
      )
    }
    return this.props.children
  }
}

// ========== TYPES ==========
interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
}
interface ActiveTrade {
  id: string
  // Ativo em que a operacao foi aberta. Opcional para nao quebrar chamadas antigas: quando vem
  // ausente a operacao e tratada como pertencente ao ativo exibido.
  symbol?: string
  entryPrice: number
  direction: "call" | "put"
  expiryTime: number
  timestamp: number
  amount?: number
}
interface Props {
  candles: Candle[]
  currentPrice: number
  activeTrades?: ActiveTrade[]
  timeframe: 60 | 300 | 600 | 900
  symbol: string
  payout?: number
  // Muda quando dados externos (ex.: feed real de BTC) ficam prontos, forcando recarga do
  // historico na serie existente sem recriar o grafico.
  reloadKey?: number
  // Direcao pre-visualizada enquanto o mouse esta sobre Comprar/Vender. Pinta a metade do
  // grafico correspondente ao lucro daquela direcao. `null` = sem preview.
  hoverDirection?: "call" | "put" | null
}
interface PnlOverlay {
  id: string
  top: number
  pnl: number
  inMoney: boolean
  isCall: boolean
  time: string
}

// ========== DRAWING TOOLS (estilo IQ Option) ==========
type DrawTool = "cursor" | "trend" | "horizontal" | "ray" | "vertical" | "rect" | "fib" | "eraser"
type DrawShape = Exclude<DrawTool, "cursor" | "eraser">
// Ancora um ponto do desenho no espaco do grafico (indice logico no eixo X, preco no eixo Y)
// para que a marcacao acompanhe o scroll/zoom do grafico.
interface DrawAnchor {
  logical: number
  price: number
}
interface Drawing {
  id: string
  type: DrawShape
  a: DrawAnchor
  b?: DrawAnchor
  color: string
}

const DRAW_COLORS = ["#fb923c", "#00E676", "#FF5252", "#FFC400", "#38bdf8", "#e2e8f0"]
const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1]

// ========== INDICADORES TECNICOS ==========
type LinePoint = { time: number; value: number }
type HistPoint = { time: number; value: number; color: string }

// Media Movel Simples (SMA) sobre os fechamentos.
function smaLine(candles: Candle[], period: number): LinePoint[] {
  const out: LinePoint[] = []
  let sum = 0
  for (let i = 0; i < candles.length; i++) {
    sum += candles[i].close
    if (i >= period) sum -= candles[i - period].close
    if (i >= period - 1) out.push({ time: candles[i].time, value: sum / period })
  }
  return out
}

// Media Movel Exponencial (EMA) generica sobre um vetor de valores.
function emaArray(values: number[], period: number): number[] {
  const k = 2 / (period + 1)
  const out: number[] = []
  let prev = 0
  for (let i = 0; i < values.length; i++) {
    if (i === 0) {
      prev = values[0]
    } else {
      prev = values[i] * k + prev * (1 - k)
    }
    out.push(prev)
  }
  return out
}

// Bandas de Bollinger: media (SMA) +/- (mult * desvio padrao) sobre a janela.
function bollingerLines(candles: Candle[], period = 20, mult = 2) {
  const upper: LinePoint[] = []
  const mid: LinePoint[] = []
  const lower: LinePoint[] = []
  for (let i = period - 1; i < candles.length; i++) {
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) sum += candles[j].close
    const mean = sum / period
    let variance = 0
    for (let j = i - period + 1; j <= i; j++) {
      const d = candles[j].close - mean
      variance += d * d
    }
    const sd = Math.sqrt(variance / period)
    const t = candles[i].time
    mid.push({ time: t, value: mean })
    upper.push({ time: t, value: mean + mult * sd })
    lower.push({ time: t, value: mean - mult * sd })
  }
  return { upper, mid, lower }
}

// MACD: (EMA rapida - EMA lenta), linha de sinal (EMA do MACD) e histograma.
function macdData(candles: Candle[], fast = 12, slow = 26, signalP = 9) {
  const empty = { macd: [] as LinePoint[], signal: [] as LinePoint[], hist: [] as HistPoint[] }
  const closes = candles.map((c) => c.close)
  if (closes.length < slow) return empty
  const emaFast = emaArray(closes, fast)
  const emaSlow = emaArray(closes, slow)
  const macdVals: number[] = []
  const macdLine: LinePoint[] = []
  for (let i = 0; i < closes.length; i++) {
    const v = emaFast[i] - emaSlow[i]
    macdVals.push(v)
    if (i >= slow - 1) macdLine.push({ time: candles[i].time, value: v })
  }
  const macdSlice = macdVals.slice(slow - 1)
  const sigArr = emaArray(macdSlice, signalP)
  const signal: LinePoint[] = []
  const hist: HistPoint[] = []
  for (let i = 0; i < macdSlice.length; i++) {
    const t = candles[slow - 1 + i].time
    signal.push({ time: t, value: sigArr[i] })
    const h = macdSlice[i] - sigArr[i]
    hist.push({ time: t, value: h, color: h >= 0 ? "rgba(0,230,118,0.55)" : "rgba(255,82,82,0.55)" })
  }
  return { macd: macdLine, signal, hist }
}

// Fractais de Bill Williams (padrao de 5 velas): topo/fundo local.
function fractalMarkers(candles: Candle[]) {
  const markers: any[] = []
  for (let i = 2; i < candles.length - 2; i++) {
    const h = candles[i].high
    const l = candles[i].low
    if (h > candles[i - 1].high && h > candles[i - 2].high && h > candles[i + 1].high && h > candles[i + 2].high) {
      markers.push({ time: candles[i].time as any, position: "aboveBar", color: "#FFC400", shape: "arrowDown" })
    }
    if (l < candles[i - 1].low && l < candles[i - 2].low && l < candles[i + 1].low && l < candles[i + 2].low) {
      markers.push({ time: candles[i].time as any, position: "belowBar", color: "#38bdf8", shape: "arrowUp" })
    }
  }
  return markers
}

// ===== Horario de Brasilia (UTC-3) no eixo de tempo =====
//
// O Lightweight Charts renderiza os rotulos do eixo em UTC por padrao. Como os candles usam
// epoch real, as 21h de Brasilia o eixo mostrava "00:xx" (o UTC ja virou o dia seguinte),
// batendo de frente com o relogio UTC-3 exibido no canto do grafico. Os formatadores abaixo
// convertem para Brasilia, deixando eixo, crosshair e relogio no mesmo fuso.
//
// O Brasil nao adota mais horario de verao desde 2019, entao o offset fixo de -3h vale o ano
// inteiro e mantem coerencia com o rotulo "UTC-3" da interface.
const BRT_OFFSET_SEC = -3 * 60 * 60

function brtParts(timeSec: number) {
  const d = new Date((timeSec + BRT_OFFSET_SEC) * 1000)
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth(),
    day: d.getUTCDate(),
    hours: d.getUTCHours(),
    minutes: d.getUTCMinutes(),
    seconds: d.getUTCSeconds(),
  }
}

const BRT_MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"]
const pad2 = (n: number) => String(n).padStart(2, "0")

// Normaliza o tempo do Lightweight Charts, que pode vir como number (epoch), string de data
// ou objeto de data por partes, para epoch em segundos.
function toEpochSec(time: any): number | null {
  if (typeof time === "number" && Number.isFinite(time)) return time
  if (typeof time === "string") {
    const ms = Date.parse(time.includes("T") ? time : `${time}T00:00:00Z`)
    return Number.isNaN(ms) ? null : ms / 1000
  }
  if (time && typeof time === "object" && "year" in time) {
    return Date.UTC(time.year, (time.month ?? 1) - 1, time.day ?? 1) / 1000
  }
  return null
}

// TickMarkType do Lightweight Charts: 0=Year, 1=Month, 2=DayOfMonth, 3=Time, 4=TimeWithSeconds
//
// O tipo do tick e classificado pela biblioteca em UTC, entao a "virada de dia" que ela sinaliza
// cai a meia-noite UTC — 21h em Brasilia. Se obedecessemos esse tipo cegamente, o eixo trocaria
// o horario das 21h pelo numero do dia. Por isso a decisao de mostrar data e refeita a partir do
// horario de Brasilia: rotulo de data so na meia-noite local, horario em todos os outros ticks.
function formatTickBRT(time: any, tickMarkType: number): string {
  const sec = toEpochSec(time)
  if (sec === null) return ""
  const p = brtParts(sec)
  const isBrtMidnight = p.hours === 0 && p.minutes === 0

  if (tickMarkType <= 2) {
    if (!isBrtMidnight) return `${pad2(p.hours)}:${pad2(p.minutes)}`
    if (tickMarkType === 0 && p.month === 0 && p.day === 1) return String(p.year)
    if (tickMarkType === 1 && p.day === 1) return BRT_MONTHS[p.month]
    return `${p.day} ${BRT_MONTHS[p.month]}`
  }
  if (tickMarkType === 4) return `${pad2(p.hours)}:${pad2(p.minutes)}:${pad2(p.seconds)}`
  return `${pad2(p.hours)}:${pad2(p.minutes)}`
}

// Usado no rotulo do crosshair, onde a data ajuda a nao confundir sessoes de dias diferentes.
function formatCrosshairBRT(time: any): string {
  const sec = toEpochSec(time)
  if (sec === null) return ""
  const p = brtParts(sec)
  return `${pad2(p.day)}/${pad2(p.month + 1)} ${pad2(p.hours)}:${pad2(p.minutes)}:${pad2(p.seconds)}`
}

const svgProps = {
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
}
const DRAW_TOOLS: { id: DrawTool; label: string; icon: React.ReactNode }[] = [
  {
    id: "cursor",
    label: "Cursor (mover grafico)",
    icon: (
      <svg {...svgProps}>
        <path d="m3 3 7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
        <path d="m13 13 6 6" />
      </svg>
    ),
  },
  {
    id: "trend",
    label: "Linha de tendencia",
    icon: (
      <svg {...svgProps}>
        <line x1="4" y1="20" x2="20" y2="4" />
      </svg>
    ),
  },
  {
    id: "horizontal",
    label: "Linha horizontal (marcar topo/fundo)",
    icon: (
      <svg {...svgProps}>
        <line x1="3" y1="12" x2="21" y2="12" />
        <circle cx="7" cy="12" r="1.5" fill="currentColor" />
        <circle cx="17" cy="12" r="1.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    id: "ray",
    label: "Raio (linha estendida)",
    icon: (
      <svg {...svgProps}>
        <line x1="4" y1="18" x2="20" y2="6" />
        <path d="M14 6h6v6" />
      </svg>
    ),
  },
  {
    id: "vertical",
    label: "Linha vertical",
    icon: (
      <svg {...svgProps}>
        <line x1="12" y1="3" x2="12" y2="21" />
      </svg>
    ),
  },
  {
    id: "rect",
    label: "Retangulo / zona",
    icon: (
      <svg {...svgProps}>
        <rect x="4" y="6" width="16" height="12" rx="1" />
      </svg>
    ),
  },
  {
    id: "fib",
    label: "Retracao de Fibonacci",
    icon: (
      <svg {...svgProps}>
        <line x1="3" y1="5" x2="21" y2="5" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <line x1="3" y1="14" x2="21" y2="14" />
        <line x1="3" y1="19" x2="21" y2="19" />
      </svg>
    ),
  },
  {
    id: "eraser",
    label: "Apagar marcacao",
    icon: (
      <svg {...svgProps}>
        <path d="m7 21-4-4a2 2 0 0 1 0-3L14 3l7 7-11 11H7z" />
        <line x1="18" y1="12.5" x2="9.5" y2="4" />
      </svg>
    ),
  },
]

// ========== HELPERS ==========
function fmtPrice(p: number, sym: string): string {
  if (!p || p <= 0) return (0).toFixed(getDecimals(sym))
  return p.toFixed(getDecimals(sym, p))
}

/**
 * Largura da vela por tempo: quanto maior o periodo, mais velas cabem na tela.
 *
 * O 15m nao tinha caso proprio e caia no mesmo espacamento do 10m, o que fazia os dois tempos
 * parecerem identicos mesmo com os dados certos.
 */
function barSpacingFor(tf: number, mobile: boolean): number {
  if (tf === 60) return mobile ? 16 : 22
  if (tf === 300) return mobile ? 11 : 15
  if (tf === 600) return mobile ? 9 : 12
  return mobile ? 7 : 10
}

function dedup(arr: Candle[]): Candle[] {
  const m = new Map<number, Candle>()
  arr.forEach((c) => {
    if (c && c.time > 0 && c.open > 0) m.set(c.time, c)
  })
  return Array.from(m.values()).sort((a, b) => a.time - b.time)
}

// Preload lightweight-charts at module level
let _lwcLib: Promise<any> | null = null
function getLwc() {
  if (!_lwcLib) {
    _lwcLib = import("lightweight-charts").catch((err) => {
      console.error("[v0] Failed to load lightweight-charts:", err)
      _lwcLib = null
      throw err
    })
  }
  return _lwcLib
}
if (typeof window !== "undefined") {
  getLwc().catch(() => {})
}

// ========== CHART CORE ==========
function ChartCore({
  candles,
  currentPrice,
  activeTrades = [],
  timeframe,
  symbol,
  payout = 0.96,
  reloadKey = 0,
  hoverDirection = null,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const countdownRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  // Incrementa toda vez que uma NOVA serie do grafico e criada (ex.: ao trocar de moeda).
  // Serve para forcar o redesenho das linhas de operacao/overlays, que dependem de seriesRef
  // (uma ref que nao dispara re-render por si so).
  const [seriesReady, setSeriesReady] = useState(0)
  const [flash, setFlash] = useState<{ id: string; dir: "call" | "put" } | null>(null)
  const [pnlOverlays, setPnlOverlays] = useState<PnlOverlay[]>([])
  // Geometria do preview de hover: y do preco atual e largura do eixo de precos,
  // para o tingimento cobrir so a area do grafico (nunca a escala da direita).
  const [hoverGeom, setHoverGeom] = useState<{ y: number; axis: number } | null>(null)
  const [clock, setClock] = useState("")

  // Relogio (horario de Brasilia, UTC-3) exibido minimizado no canto do grafico
  useEffect(() => {
    const tick = () => {
      const now = new Date()
      const utc = now.getTime() + now.getTimezoneOffset() * 60000
      const brt = new Date(utc - 3 * 60 * 60000)
      const hh = brt.getHours().toString().padStart(2, "0")
      const mm = brt.getMinutes().toString().padStart(2, "0")
      const ss = brt.getSeconds().toString().padStart(2, "0")
      setClock(`${hh}:${mm}:${ss}`)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  // Shared refs
  const chartRef = useRef<any>(null)
  const seriesRef = useRef<any>(null)
  const lwcRef = useRef<any>(null)
  const tradeLinesRef = useRef<Map<string, any>>(new Map())
  const markersApiRef = useRef<any>(null)

  // ===== INDICADORES: estado (UI) + refs (loop) =====
  const [indicators, setIndicators] = useState({ ma: false, boll: false, fractal: false, macd: false })
  const [showIndicators, setShowIndicators] = useState(false)
  const indicatorsRef = useRef(indicators)
  indicatorsRef.current = indicators
  // Espelho do array completo de velas (historico + vela em formacao) para calcular indicadores.
  const candleArrayRef = useRef<Candle[]>([])
  // Series do lightweight-charts criadas sob demanda para cada indicador.
  const indSeriesRef = useRef<{
    ma9?: any; ma21?: any
    bollU?: any; bollM?: any; bollL?: any
    macdLine?: any; macdSignal?: any; macdHist?: any
    fractal?: any
  }>({})
  const fractalMarkersApiRef = useRef<any>(null)

  // Always-fresh props
  const latest = useRef({ candles, currentPrice, timeframe, symbol })
  latest.current = { candles, currentPrice, timeframe, symbol }

  // Smooth price interpolation
  const smoothPriceRef = useRef(0)
  const formingRef = useRef<Candle | null>(null)
  const dirRef = useRef<"up" | "down" | "">("")
  const prevTargetRef = useRef(0)
  const animFrameRef = useRef(0)
  // Simbolo cujos dados ja estao carregados na serie. Enquanto null (durante o carregamento),
  // o loop de render nao aplica preco — evita "vela gigante" ao trocar de ativo.
  const loadedSymbolRef = useRef<string | null>(null)
  // Timestamp (ms) do inicio da busca de historico via rede. 0 = nenhuma em andamento.
  // Impede que o retry de 400ms empilhe varios fetch concorrentes ao mesmo endpoint
  // (efeito manada), que era o motivo de o grafico demorar muito a carregar.
  const barsFetchStartedRef = useRef(0)
  // Funcao que reconfigura opcoes + recarrega os dados na MESMA serie (sem recriar o grafico).
  const loadDataRef = useRef<null | (() => void)>(null)

  // Countdown for trade lines
  const pnlSigRef = useRef<string>("")
  const prevTradeIdsRef = useRef<string[]>([])

  // Serie a que as linhas de operacao guardadas em tradeLinesRef pertencem. Se a serie mudar,
  // os handles antigos estao mortos e precisam ser descartados (senao a linha "desaparece").
  const linesSeriesRef = useRef<any>(null)
  // Incrementado quando a pagina volta a ficar visivel: forca reconciliar as linhas de operacao
  // imediatamente, sem esperar o proximo tick do cronometro (que pode ter sido congelado).
  const [resyncKey, setResyncKey] = useState(0)

  useEffect(() => {
    const resync = () => {
      if (typeof document !== "undefined" && document.hidden) return
      setResyncKey((n) => n + 1)
    }
    document.addEventListener("visibilitychange", resync)
    window.addEventListener("focus", resync)
    window.addEventListener("pageshow", resync)
    return () => {
      document.removeEventListener("visibilitychange", resync)
      window.removeEventListener("focus", resync)
      window.removeEventListener("pageshow", resync)
    }
  }, [])

  // ===== DRAWING TOOLS state/refs =====
  const [tool, setTool] = useState<DrawTool>("cursor")
  const [drawColor, setDrawColor] = useState<string>(DRAW_COLORS[0])
  const [drawings, setDrawings] = useState<Drawing[]>([])
  const [showColors, setShowColors] = useState(false)
  const drawCanvasRef = useRef<HTMLCanvasElement>(null)
  const draftRef = useRef<Drawing | null>(null)
  const drawingsRef = useRef<Drawing[]>([])
  const toolRef = useRef<DrawTool>("cursor")
  const drawColorRef = useRef<string>(DRAW_COLORS[0])
  drawingsRef.current = drawings
  toolRef.current = tool
  drawColorRef.current = drawColor

  // Guarda as marcacoes por moeda+timeframe para que nao se percam ao trocar de ativo.
  const drawingsStoreRef = useRef<Map<string, Drawing[]>>(new Map())
  const prevDrawKeyRef = useRef<string>(`${symbol}::${timeframe}`)

  // Ao trocar de ativo/timeframe: salva as marcacoes atuais e restaura as do novo contexto.
  useEffect(() => {
    const newKey = `${symbol}::${timeframe}`
    const prevKey = prevDrawKeyRef.current

    // Salva o que estava desenhado na moeda anterior
    drawingsStoreRef.current.set(prevKey, drawingsRef.current)

    // Restaura o que ja havia sido desenhado nesta moeda (ou vazio se nunca desenhou)
    const restored = drawingsStoreRef.current.get(newKey) ?? []
    setDrawings(restored)
    draftRef.current = null
    setTool("cursor")
    prevDrawKeyRef.current = newKey
  }, [symbol, timeframe])

  // Converte uma ancora (logical, price) -> coordenada de tela (px CSS)
  function anchorToXY(a: DrawAnchor): { x: number; y: number } | null {
    const chart = chartRef.current
    const series = seriesRef.current
    if (!chart || !series) return null
    try {
      const x = chart.timeScale().logicalToCoordinate(a.logical as any)
      const y = series.priceToCoordinate(a.price)
      if (x == null || y == null) return null
      return { x, y }
    } catch {
      return null
    }
  }

  // Converte coordenada de tela (px CSS) -> ancora (logical, price)
  function xyToAnchor(x: number, y: number): DrawAnchor | null {
    const chart = chartRef.current
    const series = seriesRef.current
    if (!chart || !series) return null
    try {
      const logical = chart.timeScale().coordinateToLogical(x)
      const price = series.coordinateToPrice(y)
      if (logical == null || price == null) return null
      return { logical: logical as number, price: price as number }
    } catch {
      return null
    }
  }

  // Distancia de um ponto a um segmento (para a borracha)
  function distToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1
    const dy = y2 - y1
    const lenSq = dx * dx + dy * dy
    if (lenSq === 0) return Math.hypot(px - x1, py - y1)
    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq
    t = Math.max(0, Math.min(1, t))
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy))
  }

  // ===== Render loop das marcacoes (canvas overlay) =====
  useEffect(() => {
    let raf = 0
    let dead = false

    const render = () => {
      if (dead) return
      const canvas = drawCanvasRef.current
      const container = containerRef.current
      if (canvas && container) {
        const w = container.clientWidth
        const h = container.clientHeight
        const dpr = window.devicePixelRatio || 1
        if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
          canvas.width = Math.floor(w * dpr)
          canvas.height = Math.floor(h * dpr)
          canvas.style.width = `${w}px`
          canvas.style.height = `${h}px`
        }
        const ctx = canvas.getContext("2d")
        if (ctx) {
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
          ctx.clearRect(0, 0, w, h)
          const all = [...drawingsRef.current]
          if (draftRef.current) all.push(draftRef.current)
          all.forEach((d) => drawOne(ctx, d, w, h))
        }
      }
      raf = requestAnimationFrame(render)
    }

    const drawOne = (ctx: CanvasRenderingContext2D, d: Drawing, w: number, h: number) => {
      const pa = anchorToXY(d.a)
      if (!pa) return
      ctx.save()
      ctx.strokeStyle = d.color
      ctx.fillStyle = d.color
      ctx.lineWidth = 1.5
      ctx.font = "10px 'SF Mono',Consolas,monospace"
      const sym = latest.current.symbol

      if (d.type === "horizontal") {
        ctx.beginPath()
        ctx.moveTo(0, pa.y)
        ctx.lineTo(w, pa.y)
        ctx.stroke()
        const label = fmtPrice(d.a.price, sym)
        const tw = ctx.measureText(label).width + 8
        ctx.fillStyle = d.color
        ctx.fillRect(w - tw - 2, pa.y - 8, tw, 16)
        ctx.fillStyle = "#0d0d0f"
        ctx.fillText(label, w - tw + 2, pa.y + 3)
      } else if (d.type === "vertical") {
        ctx.beginPath()
        ctx.moveTo(pa.x, 0)
        ctx.lineTo(pa.x, h)
        ctx.stroke()
      } else if (d.type === "trend" || d.type === "ray") {
        const pb = d.b ? anchorToXY(d.b) : null
        if (!pb) {
          ctx.restore()
          return
        }
        let ex = pb.x
        let ey = pb.y
        if (d.type === "ray") {
          const dx = pb.x - pa.x
          const dy = pb.y - pa.y
          if (Math.abs(dx) < 1e-6) {
            // Raio praticamente vertical: estende ate a borda superior/inferior
            ex = pa.x
            ey = dy >= 0 ? h : 0
          } else {
            ex = dx >= 0 ? w : 0
            ey = pa.y + dy * ((ex - pa.x) / dx)
          }
        }
        ctx.beginPath()
        ctx.moveTo(pa.x, pa.y)
        ctx.lineTo(ex, ey)
        ctx.stroke()
        ctx.beginPath()
        ctx.arc(pa.x, pa.y, 3, 0, Math.PI * 2)
        ctx.fill()
        if (d.type === "trend") {
          ctx.beginPath()
          ctx.arc(pb.x, pb.y, 3, 0, Math.PI * 2)
          ctx.fill()
        }
      } else if (d.type === "rect") {
        const pb = d.b ? anchorToXY(d.b) : null
        if (!pb) {
          ctx.restore()
          return
        }
        const x = Math.min(pa.x, pb.x)
        const y = Math.min(pa.y, pb.y)
        const rw = Math.abs(pb.x - pa.x)
        const rh = Math.abs(pb.y - pa.y)
        ctx.globalAlpha = 0.12
        ctx.fillRect(x, y, rw, rh)
        ctx.globalAlpha = 1
        ctx.strokeRect(x, y, rw, rh)
      } else if (d.type === "fib") {
        const pb = d.b ? anchorToXY(d.b) : null
        if (!pb) {
          ctx.restore()
          return
        }
        const x1 = Math.min(pa.x, pb.x)
        const x2 = Math.max(pa.x, pb.x)
        FIB_LEVELS.forEach((lvl) => {
          const price = d.a.price + (d.b!.price - d.a.price) * lvl
          const yc = seriesRef.current?.priceToCoordinate(price)
          if (yc == null) return
          ctx.globalAlpha = 0.9
          ctx.beginPath()
          ctx.moveTo(x1, yc)
          ctx.lineTo(x2, yc)
          ctx.stroke()
          ctx.globalAlpha = 1
          ctx.fillStyle = d.color
          ctx.fillText(`${(lvl * 100).toFixed(1)}%  ${fmtPrice(price, sym)}`, x1 + 4, yc - 3)
        })
      }
      ctx.restore()
    }

    raf = requestAnimationFrame(render)
    return () => {
      dead = true
      cancelAnimationFrame(raf)
    }
  }, [])

  // ===== Pointer handlers para desenhar =====
  function getPos(e: React.PointerEvent): { x: number; y: number } {
    const rect = drawCanvasRef.current!.getBoundingClientRect()
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  function handleDrawPointerDown(e: React.PointerEvent) {
    const t = toolRef.current
    if (t === "cursor") return
    const pos = getPos(e)

    if (t === "eraser") {
      const list = drawingsRef.current
      let hitId: string | null = null
      let best = 10
      for (let i = list.length - 1; i >= 0; i--) {
        const d = list[i]
        const pa = anchorToXY(d.a)
        if (!pa) continue
        let dist = Infinity
        if (d.type === "horizontal") dist = Math.abs(pos.y - pa.y)
        else if (d.type === "vertical") dist = Math.abs(pos.x - pa.x)
        else {
          const pb = d.b ? anchorToXY(d.b) : pa
          if (pb) dist = distToSegment(pos.x, pos.y, pa.x, pa.y, pb.x, pb.y)
        }
        if (dist < best) {
          best = dist
          hitId = d.id
        }
      }
      if (hitId) setDrawings((prev) => prev.filter((d) => d.id !== hitId))
      return
    }

    const anchor = xyToAnchor(pos.x, pos.y)
    if (!anchor) return
    const id = `d${Date.now()}${Math.random().toString(36).slice(2, 6)}`
    const color = drawColorRef.current

    if (t === "horizontal" || t === "vertical") {
      // Ferramentas de 1 clique: coloca imediatamente e mantem a ferramenta ativa
      // para permitir marcar varios topos/fundos em sequencia.
      setDrawings((prev) => [...prev, { id, type: t, a: anchor, color }])
      return
    }

    // Ferramentas de 2 pontos: inicia rascunho e captura o ponteiro
    draftRef.current = { id, type: t as DrawShape, a: anchor, b: anchor, color }
    try {
      drawCanvasRef.current?.setPointerCapture(e.pointerId)
    } catch {}
  }

  function handleDrawPointerMove(e: React.PointerEvent) {
    if (!draftRef.current) return
    const pos = getPos(e)
    const anchor = xyToAnchor(pos.x, pos.y)
    if (anchor) draftRef.current = { ...draftRef.current, b: anchor }
  }

  function handleDrawPointerUp(e: React.PointerEvent) {
    const draft = draftRef.current
    draftRef.current = null
    try {
      drawCanvasRef.current?.releasePointerCapture(e.pointerId)
    } catch {}
    if (!draft || !draft.b) return
    const pa = anchorToXY(draft.a)
    const pb = anchorToXY(draft.b)
    // Descarta se muito pequeno (clique acidental)
    if (pa && pb && Math.hypot(pb.x - pa.x, pb.y - pa.y) < 6) return
    setDrawings((prev) => [...prev, draft])
  }

  // Operacoes que pertencem ao ativo exibido AGORA.
  //
  // O grafico recebe todas as operacoes abertas da conta, mas ele desenha um unico ativo. Sem
  // este filtro a linha de uma operacao de outro ativo era criada nesta serie: o preco de entrada
  // vive numa escala completamente diferente (ex.: BTC em 43.590 sobre o EUR/USD em 1,08), entao
  // ela caia fora da area visivel e o cronometro/P&L flutuante era projetado por
  // `priceToCoordinate` para uma coordenada fora do grafico, aparecendo grudado na borda e por
  // cima do rotulo da operacao do ativo atual — que foi o efeito de "a entrada nao marcou" ao
  // trocar de aba.
  //
  // Operacoes sem `symbol` (chamadas antigas) continuam sendo desenhadas, para nao esconder nada.
  const chartTrades = useMemo(
    () => activeTrades.filter((t) => !t.symbol || t.symbol === symbol),
    [activeTrades, symbol],
  )

  // ===== Detect new trades -> flash animation =====
  useEffect(() => {
    const ids = chartTrades.map((t) => t.id)
    const newOnes = chartTrades.filter((t) => !prevTradeIdsRef.current.includes(t.id))
    if (newOnes.length > 0) {
      const t = newOnes[newOnes.length - 1]
      setFlash({ id: t.id, dir: t.direction })
      const to = setTimeout(() => setFlash(null), 700)
      prevTradeIdsRef.current = ids
      return () => clearTimeout(to)
    }
    prevTradeIdsRef.current = ids
  }, [chartTrades])

  // O antigo "countdown timer" que alimentava o estado `cds` foi removido: ele disparava um
  // setInterval de 250ms (re-render 4x/s) cujo unico consumidor — o efeito das linhas de trade —
  // ja nao usava `cds` (o tempo restante e calculado na hora, direto de trade.timestamp).
  // Mante-lo so causava re-renders e recriacao das linhas de preco sem beneficio visual.

  // ===== Update header (OHLC + price) =====
  function updateHeader(c: Candle, price: number) {
    if (!headerRef.current) return
    const s = latest.current.symbol
    const fp = (p: number) => fmtPrice(p, s)
    const pct = c.open > 0 ? ((price - c.open) / c.open) * 100 : 0
    const sym = s.replace("_OTC", "").replace("-OTC", "")
    const clr = pct >= 0 ? "#00E676" : "#FF5252"
    headerRef.current.innerHTML =
      `<span style="color:#E2E8F0;font-weight:700;font-size:13px">${sym}</span>` +
      `<span style="color:#334155;margin:0 6px">|</span>` +
      `<span style="color:#94A3B8;font-size:11px">O <span style="color:#E2E8F0">${fp(c.open)}</span></span>` +
      `<span style="color:#94A3B8;font-size:11px;margin-left:8px">H <span style="color:#00E676">${fp(c.high)}</span></span>` +
      `<span style="color:#94A3B8;font-size:11px;margin-left:8px">L <span style="color:#FF5252">${fp(c.low)}</span></span>` +
      `<span style="color:#94A3B8;font-size:11px;margin-left:8px">C <span style="color:${clr}">${fp(price)}</span></span>` +
      `<span style="color:${clr};font-size:11px;font-weight:700;margin-left:8px;padding:1px 5px;border-radius:4px;background:${clr}1a">${pct >= 0 ? "+" : ""}${pct.toFixed(3)}%</span>`
  }

  // ===== Contador regressivo do fechamento da vela (estilo IQ Option) =====
  // Mostra MM:SS que faltam para a vela atual fechar, alinhado verticalmente a linha do preco
  // atual (borda direita). Fica vermelho nos ultimos 10s para chamar a atencao.
  function updateCountdown(price: number) {
    const el = countdownRef.current
    if (!el) return
    const tf = latest.current.timeframe
    const nowMs = Date.now()
    const remaining = Math.max(0, Math.ceil((Math.ceil(nowMs / 1000 / tf) * tf - nowMs / 1000)))
    const mm = Math.floor(remaining / 60)
    const ss = remaining % 60
    el.textContent = `${mm}:${ss.toString().padStart(2, "0")}`

    // Posiciona verticalmente na altura do preco atual, se possivel.
    let y: number | null = null
    try {
      const c = seriesRef.current?.priceToCoordinate(price)
      if (typeof c === "number" && Number.isFinite(c)) y = c
    } catch {}
    if (y != null) {
      el.style.top = `${y}px`
      el.style.transform = "translateY(-50%)"
    }
    const urgent = remaining <= 10
    el.style.backgroundColor = urgent ? "#FF5252" : "#1E222D"
    el.style.color = urgent ? "#fff" : "#E2E8F0"
    el.style.opacity = "1"
  }

  // ===== MAIN CHART EFFECT (recreate on symbol/timeframe change) =====
  useEffect(() => {
    let dead = false
    let ro: ResizeObserver | null = null
    let winResizeCleanup: (() => void) | null = null
    let lastFrameAt = 0
    let watchdog: ReturnType<typeof setInterval> | null = null
    let onVisible: (() => void) | null = null

    async function boot() {
      if (!containerRef.current || dead) return
      if (containerRef.current.clientWidth === 0 || containerRef.current.clientHeight === 0) {
        if (!dead) setTimeout(boot, 30)
        return
      }

      const lwc = await getLwc()
      if (dead || !containerRef.current || !lwc?.createChart) return

      const CT = lwc.ColorType || { Solid: "solid" }
      const CM = lwc.CrosshairMode || { Normal: 0 }
      const LS = lwc.LineStyle || { Dashed: 1 }
      const isMobile = containerRef.current.clientWidth < 768

      // Bigger candles on shorter timeframes (broker-style zoom)
      const tf0 = latest.current.timeframe
      const barSpacing =
        tf0 === 60
          ? isMobile
            ? 16
            : 22
          : tf0 === 300
            ? isMobile
              ? 11
              : 15
            : isMobile
              ? 9
              : 12

      const chart = lwc.createChart(containerRef.current, {
        width: containerRef.current.clientWidth,
        height: containerRef.current.clientHeight,
        layout: {
          background: { type: CT.Solid, color: "rgba(0,0,0,0)" },
          textColor: "#787B86",
          fontSize: 11,
          fontFamily: "'SF Mono',Consolas,monospace",
          attributionLogo: false,
        },
        grid: {
          vertLines: { color: "rgba(42, 46, 57, 0.4)" },
          horzLines: { color: "rgba(42, 46, 57, 0.4)" },
        },
        crosshair: {
          mode: CM.Normal,
          vertLine: { color: "rgba(255,255,255,0.35)", width: 1, style: LS.Dashed, labelBackgroundColor: "#2A2E39" },
          horzLine: { color: "rgba(255,255,255,0.35)", width: 1, style: LS.Dashed, labelBackgroundColor: "#2A2E39" },
        },
        rightPriceScale: { borderColor: "#363A45", autoScale: true, scaleMargins: { top: 0.12, bottom: 0.12 } },
        localization: {
          locale: "pt-BR",
          timeFormatter: formatCrosshairBRT,
        },
        timeScale: {
          borderColor: "#363A45",
          timeVisible: true,
          secondsVisible: tf0 <= 60,
          tickMarkFormatter: formatTickBRT,
          barSpacing,
          minBarSpacing: 2,
          rightOffset: tf0 === 60 ? 12 : 8,
          shiftVisibleRangeOnNewBar: true,
        },
        handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true },
        handleScale: {
          mouseWheel: true,
          pinch: true,
          axisPressedMouseMove: { time: true, price: true },
          axisDoubleClickReset: { time: true, price: true },
        },
        kineticScroll: { touch: true, mouse: false },
      })
      if (dead) {
        try {
          chart.remove()
        } catch {}
        return
      }

      // Precisao por ativo: garante que cada simbolo (inclusive memecoins com 8 casas) renderize corretamente
      const dec = getDecimals(latest.current.symbol, latest.current.currentPrice)
      const cOpts = {
        upColor: "#00E676",
        downColor: "#FF5252",
        borderUpColor: "#00E676",
        borderDownColor: "#FF5252",
        wickUpColor: "#00E676",
        wickDownColor: "#FF5252",
        priceLineVisible: true,
        priceLineColor: "#787B86",
        priceLineWidth: 1 as const,
        lastValueVisible: true,
        priceFormat: {
          type: "price" as const,
          precision: dec,
          minMove: Number((1 / Math.pow(10, dec)).toFixed(dec)),
        },
      }

      let cs: any
      try {
        cs = lwc.CandlestickSeries ? chart.addSeries(lwc.CandlestickSeries, cOpts) : (chart as any).addCandlestickSeries(cOpts)
      } catch {
        try {
          cs = (chart as any).addCandlestickSeries(cOpts)
        } catch {
          try {
            chart.remove()
          } catch {}
          return
        }
      }
      if (!cs || dead) {
        try {
          chart.remove()
        } catch {}
        return
      }

      chartRef.current = chart
      seriesRef.current = cs
      lwcRef.current = lwc
      // Sinaliza que a serie esta pronta para que as linhas de operacao/overlays
      // sejam (re)desenhadas — essencial ao voltar para uma moeda com operacao ativa.
      if (!dead) setSeriesReady((n) => n + 1)

      // Markers API (v5 uses createSeriesMarkers)
      try {
        if (lwc.createSeriesMarkers) {
          markersApiRef.current = lwc.createSeriesMarkers(cs, [])
        }
      } catch {}

      chart.subscribeCrosshairMove((p: any) => {
        if (!p?.seriesData) return
        const d = p.seriesData.get(cs)
        if (d && "open" in d) updateHeader(d as Candle, (d as Candle).close)
      })

      // Re-fit the chart to its container (used by ResizeObserver + window events)
      const refit = () => {
        if (!containerRef.current || !chartRef.current) return
        const w = containerRef.current.clientWidth
        const h = containerRef.current.clientHeight
        if (w > 0 && h > 0) {
          try {
            chartRef.current.applyOptions({ width: w, height: h })
          } catch {}
        }
      }

      ro = new ResizeObserver(() => refit())
      ro.observe(containerRef.current)

      // iOS Safari often doesn't fire ResizeObserver when the URL bar collapses/expands
      // or on orientation change, so refit on these window events too.
      const onWinResize = () => {
        refit()
        // run again after the mobile browser chrome settles
        setTimeout(refit, 250)
      }
      window.addEventListener("resize", onWinResize)
      window.addEventListener("orientationchange", onWinResize)
      winResizeCleanup = () => {
        window.removeEventListener("resize", onWinResize)
        window.removeEventListener("orientationchange", onWinResize)
      }

      // ===== (Re)configuracao + carga de dados na MESMA serie =====
      // Chamado na criacao e a cada troca de ativo/timeframe, SEM recriar o grafico
      // (elimina o flash/congelamento). Um token evita corridas entre cargas concorrentes.
      let loadToken = 0
      const loadData = () => {
        if (dead || !chartRef.current || !seriesRef.current) return
        const myToken = ++loadToken
        const sym = latest.current.symbol
        const tf = latest.current.timeframe
        const mob = containerRef.current ? containerRef.current.clientWidth < 768 : false
        const bs = barSpacingFor(tf, mob)

        // Bloqueia o loop de render de aplicar preco ate os novos dados chegarem
        loadedSymbolRef.current = null
        smoothPriceRef.current = 0
        formingRef.current = null
        prevTargetRef.current = 0

        // Reaplica opcoes que dependem do timeframe / precisao do ativo
        try {
          chartRef.current.timeScale().applyOptions({
            secondsVisible: tf <= 60,
            barSpacing: bs,
            rightOffset: tf === 60 ? 12 : 8,
          })
        } catch {}
        try {
          const dc = getDecimals(sym, latest.current.currentPrice)
          seriesRef.current.applyOptions({
            priceFormat: { type: "price", precision: dc, minMove: Number((1 / Math.pow(10, dc)).toFixed(dc)) },
          })
        } catch {}

        // ===== Historico via DATAFEED =====
        // O historico agora vem do datafeed (getBars), que no mercado aberto busca o OHLC real
        // com maxima e minima de verdade, e no OTC le o motor deterministico. Antes o grafico
        // montava as velas so a partir do motor local: no forex isso dependia do feed ja ter
        // preenchido o store, e a fonte anterior devolvia velas achatadas
        // (open=high=low=close), que e o motivo de o desenho nao bater com o mercado real.
        barsFetchStartedRef.current = Date.now()
        void getBars(sym as any, tf as any)
          .then((bars) => {
            barsFetchStartedRef.current = 0
            // Uma carga mais nova comecou no meio do caminho: descarta esta resposta.
            if (dead || myToken !== loadToken || !seriesRef.current || !chartRef.current) return
            applyBars(dedup(bars as Candle[]))
          })
          .catch((err) => {
            barsFetchStartedRef.current = 0
            console.error("[v0] Falha ao montar o historico do grafico:", err)
            if (dead || myToken !== loadToken) return
            applyBars([])
          })
      }

      // Desenha a serie recebida do datafeed. Extraido para fora do loadData porque agora o
      // historico chega de forma assincrona.
      const applyBars = (bars: Candle[]) => {
        if (!chartRef.current || !seriesRef.current) return
        const tf = latest.current.timeframe
        const sym = latest.current.symbol
        const mob = containerRef.current ? containerRef.current.clientWidth < 768 : false
        const bs = barSpacingFor(tf, mob)

        let baseData = bars

        // Usa a serie mais completa das duas. O historico pode chegar curto nos primeiros
        // instantes de um ativo de mercado aberto; nesse caso as velas vindas do hook
        // desenham mais do grafico.
        const fromProps = dedup(latest.current.candles || [])
        if (fromProps.length > baseData.length) baseData = fromProps

        if (baseData.length > 0) {
          try {
            seriesRef.current.setData(
              baseData.map((c) => ({ time: c.time as any, open: c.open, high: c.high, low: c.low, close: c.close })),
            )
          } catch (err) {
            // Silenciar aqui foi o que escondeu o grafico vazio: a serie ficava sem dados e
            // nada indicava o motivo.
            console.error("[v0] setData rejeitou as velas:", err, "velas:", baseData.length)
          }
          const last = baseData[baseData.length - 1]
          formingRef.current = { ...last }
          smoothPriceRef.current = last.close
          prevTargetRef.current = last.close
          updateHeader(last, last.close)
          // Espelha o historico para os indicadores (recomputados por um loop proprio).
          candleArrayRef.current = baseData.map((c) => ({ ...c }))

          // Posiciona o intervalo visivel: ultimas N velas preenchendo a largura, com a
          // vela atual proxima da borda direita. setVisibleLogicalRange preserva o auto-follow.
          try {
            const total = baseData.length
            const rightBars = tf === 60 ? 5 : 4
            const fit = Math.max(20, Math.floor((containerRef.current?.clientWidth || 600) / bs))
            const visibleCount = Math.min(total, fit - rightBars)
            chartRef.current.timeScale().setVisibleLogicalRange({
              from: total - visibleCount,
              to: total + rightBars,
            })
          } catch {}
          loadedSymbolRef.current = sym
          setLoading(false)
        } else {
          // Sem velas para este (ativo, timeframe) ainda.
          //
          // Este era o motivo de o grafico NAO MUDAR ao trocar o tempo no forex: a serie so era
          // reescrita quando havia dados, entao com a lista vazia o `setData` nunca era chamado
          // e as velas do tempo ANTERIOR continuavam desenhadas. Num ativo de mercado aberto a
          // troca de tempo passa sempre por esse estado — o historico daquele tempo so existe
          // depois que o feed busca (`pollCandles`) —, ou seja, trocar de 5m para 15m deixava o
          // grafico exibindo 5m indefinidamente.
          //
          // Limpar a serie e manter `loadedSymbolRef` nulo garante que nada do tempo antigo
          // sobreviva e que o loop de render nao escreva preco novo dentro de velas erradas.
          // O efeito de reload roda de novo assim que o historico do novo tempo chega.
          try {
            seriesRef.current.setData([])
          } catch {}
          candleArrayRef.current = []
          loadedSymbolRef.current = null
          setLoading(true)
        }
        // Redesenha linhas de operacao/overlays sobre os novos dados
        setSeriesReady((n) => n + 1)
      }
      loadDataRef.current = loadData
      loadData()

      // ===== Aplicacao de um frame (preco -> vela) =====
      // Isolada para poder ser chamada tanto pelo requestAnimationFrame (60fps suave) quanto
      // pelo fallback de setInterval (garante atualizacao mesmo quando o rAF e estrangulado,
      // ex.: dentro de iframes/preview ou abas em segundo plano).
      const renderFrame = () => {
        if (dead || !seriesRef.current) return

        // ===== Deteccao direta de congelamento (robusta em qualquer ambiente) =====
        // Em vez de confiar so nos eventos de visibilidade — que no mobile as vezes nem disparam
        // (o navegador suspende JS/timers ao trocar de app, e o retorno pode vir por pageshow,
        // bfcache ou simplesmente pelo watchdog) — medimos o salto de tempo desde o ultimo frame.
        // Se o loop ficou parado tempo demais, o proximo frame desenharia uma unica vela-ponte
        // gigante cobrindo todo o periodo ausente (o "candle bugado" que so o F5 corrigia).
        // Reconstruir a serie pelo datafeed recria corretamente as velas do intervalo. Como isso
        // roda dentro do proprio renderFrame, cobre TODO caminho de retomada, nao so os eventos.
        const nowMs = Date.now()
        if (lastFrameAt > 0 && nowMs - lastFrameAt > 2000 && loadedSymbolRef.current !== null && loadDataRef.current) {
          lastFrameAt = nowMs
          loadDataRef.current()
          return
        }

        const sym = latest.current.symbol
        const tf = latest.current.timeframe
        // Le o preco vivo DIRETO do motor deterministico a cada frame, usando o simbolo atual.
        // Antes o preco vinha por props (hook -> pagina -> props -> latest.current), e essa
        // propagacao por re-render as vezes atrasava/congelava apos varias trocas rapidas de
        // ativo (o preco "parava" ate um foco/minimizar reiniciar o ciclo). Lendo direto do
        // motor — a mesma fonte pura e determinstica usada em loadData — o preco nunca fica preso
        // e sempre corresponde a escala da vela carregada (nao ha contaminacao entre ativos).
        let target = 0
        try {
          target = multiAssetEngine.getCurrentPrice(sym as any)
        } catch {
          target = latest.current.currentPrice
        }

        // ===== MERCADO ABERTO: renderiza a vela de ticks, sem reconstrui-la =====
        // Nos ativos reais o OHLC vem pronto do motor, formado tick a tick pelo feed. O caminho
        // abaixo (suavizacao exponencial + high/low recalculados no cliente) e do motor OTC: ao
        // aplica-lo aos ativos reais, cada frame empurrava um preco interpolado para dentro da
        // vela e os extremos cresciam a cada frame, criando pavios que o mercado nao teve.
        // Aqui apenas atualizamos a vela existente, sem redesenhar a serie.
        if (isRealSymbol(sym)) {
          const live = multiAssetEngine.getCurrentCandle(sym as any, tf)
          if (!live) {
            // O historico ja esta desenhado, mas o feed ao vivo (SSE/poll) ainda nao entregou o
            // primeiro tick da vela do periodo corrente. Isso NAO e um congelamento: o loop de
            // render esta vivo, so falta o dado. Marcamos o frame como executado para o watchdog
            // de 2s (deteccao de congelamento) NAO interpretar essa espera como travamento e
            // disparar um loadData() completo em cadeia a cada ~2s — esse ciclo de recarga era o
            // "candle bugado" intermitente ao entrar, que so o F5 resolvia. O proximo frame desenha
            // a vela assim que o primeiro tick chegar do feed.
            lastFrameAt = Date.now()
            return
          }

          const f = formingRef.current
          if (!f || live.time > f.time) {
            // Novo periodo: a vela nasce com o dado real do motor (Open = fechamento anterior).
            formingRef.current = { ...live }
          } else if (live.time === f.time) {
            // Mesmo periodo: atualizacao continua dos extremos e do fechamento.
            f.open = live.open
            f.high = live.high
            f.low = live.low
            f.close = live.close
          }

          const cur = formingRef.current!
          if (cur.close > prevTargetRef.current) dirRef.current = "up"
          else if (cur.close < prevTargetRef.current) dirRef.current = "down"
          prevTargetRef.current = cur.close
          smoothPriceRef.current = cur.close

          const arr = candleArrayRef.current
          if (arr.length && arr[arr.length - 1].time === cur.time) {
            arr[arr.length - 1] = { ...cur }
          } else {
            arr.push({ ...cur })
            if (arr.length > 600) arr.shift()
          }

          try {
            seriesRef.current.update({
              time: cur.time as any,
              open: cur.open,
              high: cur.high,
              low: cur.low,
              close: cur.close,
            })
          } catch {}
          updateHeader(cur, cur.close)
          updateCountdown(cur.close)
          lastFrameAt = Date.now()
          return
        }

        if (target > 0 && formingRef.current) {
          if (smoothPriceRef.current === 0) smoothPriceRef.current = target
          // Suavizacao relativa a escala do preco: funciona para qualquer magnitude
          // (forex, acoes, cripto e memecoins) sem depender do simbolo.
          const refPrice = smoothPriceRef.current || target
          const ratio = Math.abs(target - refPrice) / Math.max(Math.abs(refPrice), 1e-12)
          const alpha = ratio > 0.01 ? 0.8 : ratio > 0.002 ? 0.15 : ratio > 0.0005 ? 0.08 : 0.05
          smoothPriceRef.current += (target - smoothPriceRef.current) * alpha
          const price = smoothPriceRef.current

          const moveRatio = Math.abs(target - prevTargetRef.current) / Math.max(Math.abs(prevTargetRef.current), 1e-12)
          if (moveRatio > 0.00005) {
            dirRef.current = target > prevTargetRef.current ? "up" : "down"
            prevTargetRef.current = target
          }

          // New candle period?
          const nowSec = Math.floor(Date.now() / 1000)
          const newTime = Math.floor(nowSec / tf) * tf
          const f = formingRef.current
          if (newTime > f.time) {
            formingRef.current = { time: newTime, open: price, high: price, low: price, close: price }
          } else {
            f.close = price
            f.high = Math.max(f.high, price)
            f.low = Math.min(f.low, price)
          }
          // Mantem o espelho de velas em sincronia para os indicadores.
          {
            const arr = candleArrayRef.current
            const cur = formingRef.current
            if (arr.length && arr[arr.length - 1].time === cur.time) {
              arr[arr.length - 1] = { ...cur }
            } else {
              arr.push({ ...cur })
              if (arr.length > 600) arr.shift()
            }
          }
          try {
            seriesRef.current.update({
              time: formingRef.current.time as any,
              open: formingRef.current.open,
              high: formingRef.current.high,
              low: formingRef.current.low,
              close: formingRef.current.close,
            })
          } catch {}
          // O auto-follow ao criar nova vela e tratado por shiftVisibleRangeOnNewBar.
          updateHeader(formingRef.current, price)
          updateCountdown(price)
        }
        lastFrameAt = Date.now()
      }

      // ===== Loop de render com limite de taxa (~20fps) via requestAnimationFrame =====
      // O rAF dispara ~60x/s, mas cada renderFrame redesenha o canvas do grafico, reescreve o
      // innerHTML do header e reposiciona o contador — trabalho pesado o suficiente para, a 60fps,
      // manter a thread principal ocupada e ATRASAR a resposta a toques/cliques no mobile.
      // Um grafico de opcoes e visualmente identico a ~20fps, entao limitamos o trabalho real a
      // cada ~48ms (mantendo o rAF apenas para agendar e pausar sozinho em segundo plano). Isso
      // corta ~3x o trabalho de render por segundo e libera a thread para responder aos botoes.
      const FRAME_INTERVAL_MS = 48
      let lastRenderAt = 0
      const tick = () => {
        if (dead) return
        const now = Date.now()
        if (now - lastRenderAt >= FRAME_INTERVAL_MS) {
          lastRenderAt = now
          renderFrame()
        }
        animFrameRef.current = requestAnimationFrame(tick)
      }
      lastFrameAt = Date.now()
      animFrameRef.current = requestAnimationFrame(tick)

      // ===== Fallback garantido via setInterval =====
      // Alguns ambientes (preview em iframe, abas em segundo plano, alguns navegadores mobile)
      // estrangulam o requestAnimationFrame ate quase parar — o que deixa o grafico "travado".
      // Este intervalo aplica um frame diretamente se o rAF nao rodou nos ultimos ~250ms,
      // garantindo que o grafico SEMPRE continue atualizando, em qualquer ambiente.
      watchdog = setInterval(() => {
        if (dead || !seriesRef.current) return
        if (Date.now() - lastFrameAt > 250) {
          renderFrame()
        }
      }, 250)
      // Guarda o instante em que a aba foi para segundo plano. Em background o navegador
      // estrangula/congela o requestAnimationFrame, mas o preco OTC e deterministico e continua
      // avancando no tempo. Se apenas retomassemos o loop, o primeiro frame ao voltar criaria
      // uma vela-ponte gigante (abre no ultimo preco visto, fecha no preco atual) — era o candle
      // bugado que so o F5 corrigia.
      let hiddenSince = 0
      onVisible = () => {
        if (typeof document === "undefined") return
        if (document.hidden) {
          hiddenSince = Date.now()
          return
        }
        const awayMs = hiddenSince ? Date.now() - hiddenSince : 0
        hiddenSince = 0
        // Ficou tempo suficiente para os frames serem descartados: reconstroi a serie inteira
        // pelo datafeed (mesmo efeito do F5), o que recria corretamente todas as velas do periodo
        // ausente em vez de desenhar uma unica vela-ponte gigante.
        if (awayMs > 1200 && loadDataRef.current) {
          loadDataRef.current()
        } else {
          renderFrame()
        }
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
        animFrameRef.current = requestAnimationFrame(tick)
      }
      document.addEventListener("visibilitychange", onVisible)
      window.addEventListener("focus", onVisible)
      // pageshow cobre o retorno pelo cache de historico (bfcache) do iOS Safari, onde nem
      // visibilitychange nem focus disparam de forma confiavel ao voltar para a aba.
      window.addEventListener("pageshow", onVisible)
    }

    boot()

    return () => {
      dead = true
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
      if (watchdog) clearInterval(watchdog)
      if (onVisible) {
        document.removeEventListener("visibilitychange", onVisible)
        window.removeEventListener("focus", onVisible)
        // pageshow tambem precisa ser removido: sem isto, cada re-execucao do efeito (troca de
        // par/timeframe) deixava um onVisible orfao preso no pageshow. Ao voltar para a aba (no
        // mobile o retorno vem por pageshow/bfcache), TODOS os orfaos acumulados disparavam de uma
        // vez, cada um chamando loadData() — dezenas de recargas simultaneas travavam o grafico.
        window.removeEventListener("pageshow", onVisible)
      }
      if (ro) ro.disconnect()
      if (winResizeCleanup) winResizeCleanup()
      if (chartRef.current) {
        try {
          chartRef.current.remove()
        } catch {}
      }
      chartRef.current = null
      seriesRef.current = null
      lwcRef.current = null
      markersApiRef.current = null
      loadDataRef.current = null
      loadedSymbolRef.current = null
      tradeLinesRef.current.clear()
      smoothPriceRef.current = 0
      formingRef.current = null
      prevTargetRef.current = 0
    }
    // Cria o grafico UMA unica vez (mount). A troca de ativo/timeframe apenas recarrega os
    // dados na mesma serie, sem recriar — por isso o grafico nunca "trava" nem pisca.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Recarrega os dados na serie existente quando o ativo, o timeframe ou o reloadKey muda
  // (instantaneo). O reloadKey muda quando o feed real fica pronto, trocando o historico
  // sintetico pelo real sem recriar o grafico.
  useEffect(() => {
    loadDataRef.current?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, timeframe, reloadKey])

  // Fluxo AO VIVO da vela atual (WebSocket via SSE, com reserva por consulta).
  //
  // O datafeed grava cada tick no store de precos, que e a mesma fonte que o loop de render do
  // grafico e a liquidacao das operacoes consultam. Por isso o preco chega em tempo real sem
  // alterar nada do desenho, dos indicadores ou das ferramentas.
  useEffect(() => {
    if (!isRealSymbol(symbol)) return
    const id = subscribeBars(symbol, timeframe as 60 | 300 | 600 | 900, () => {})
    return () => unsubscribeBars(id)
  }, [symbol, timeframe])

  // Enquanto o par (ativo, timeframe) atual nao tiver velas, tenta recarregar a cada 400ms.
  // Ao trocar o tempo de um ativo de mercado aberto, o historico daquele tempo chega da rede
  // alguns instantes depois; sem esta tentativa o grafico so preencheria no proximo ciclo do
  // feed (ate 15s de espera) ou ficaria parado caso a primeira busca falhasse.
  useEffect(() => {
    if (!loading) return
    const id = setInterval(() => {
      if (loadedSymbolRef.current !== null) return
      // Nao empilha fetch: so tenta de novo se nenhuma busca esta em andamento
      // (ou se a atual travou por mais de 4s).
      const inFlight = barsFetchStartedRef.current > 0 && Date.now() - barsFetchStartedRef.current < 4000
      if (inFlight) return
      loadDataRef.current?.()
    }, 400)
    return () => clearInterval(id)
  }, [loading, symbol, timeframe])

  // ===== INDICADORES: cria/remove series e atualiza os dados =====
  useEffect(() => {
    const chart = chartRef.current
    const lwc = lwcRef.current
    if (!chart || !lwc) return

    const S = indSeriesRef.current
    const ind = indicators
    const lineOpts = (color: string, extra: any = {}) => ({
      color,
      lineWidth: 2,
      priceLineVisible: false,
      lastValueVisible: false,
      crosshairMarkerVisible: false,
      ...extra,
    })
    const addLine = (opts: any, pane = 0) =>
      lwc.LineSeries ? chart.addSeries(lwc.LineSeries, opts, pane) : (chart as any).addLineSeries(opts)
    const addHist = (opts: any, pane = 0) =>
      lwc.HistogramSeries ? chart.addSeries(lwc.HistogramSeries, opts, pane) : (chart as any).addHistogramSeries(opts)
    const remove = (key: keyof typeof S) => {
      if (S[key]) {
        try {
          chart.removeSeries(S[key])
        } catch {}
        S[key] = undefined
      }
    }

    // --- Medias Moveis (SMA 9 e SMA 21) ---
    if (ind.ma && !S.ma9) {
      S.ma9 = addLine(lineOpts("#FFC400"))
      S.ma21 = addLine(lineOpts("#38bdf8"))
    } else if (!ind.ma && S.ma9) {
      remove("ma9")
      remove("ma21")
    }

    // --- Bandas de Bollinger (20, 2) ---
    if (ind.boll && !S.bollM) {
      S.bollU = addLine(lineOpts("#787B86", { lineWidth: 1 }))
      S.bollM = addLine(lineOpts("#fb923c", { lineWidth: 1, lineStyle: lwc.LineStyle?.Dashed ?? 1 }))
      S.bollL = addLine(lineOpts("#787B86", { lineWidth: 1 }))
    } else if (!ind.boll && S.bollM) {
      remove("bollU")
      remove("bollM")
      remove("bollL")
    }

    // --- Fractais (marcadores numa serie transparente propria) ---
    if (ind.fractal && !S.fractal) {
      S.fractal = addLine(lineOpts("rgba(0,0,0,0)", { lineWidth: 1 }))
      try {
        if (lwc.createSeriesMarkers) fractalMarkersApiRef.current = lwc.createSeriesMarkers(S.fractal, [])
      } catch {}
    } else if (!ind.fractal && S.fractal) {
      try {
        fractalMarkersApiRef.current?.setMarkers([])
      } catch {}
      fractalMarkersApiRef.current = null
      remove("fractal")
    }

    // --- MACD (12, 26, 9) em painel separado abaixo ---
    if (ind.macd && !S.macdHist) {
      S.macdHist = addHist({ priceLineVisible: false, lastValueVisible: false, priceFormat: { type: "volume" } }, 1)
      S.macdLine = addLine(lineOpts("#38bdf8"), 1)
      S.macdSignal = addLine(lineOpts("#FFC400"), 1)
      try {
        const panes = chart.panes?.()
        if (panes && panes[1]?.setHeight) panes[1].setHeight(120)
      } catch {}
    } else if (!ind.macd && S.macdHist) {
      remove("macdHist")
      remove("macdLine")
      remove("macdSignal")
    }

    // Recalcula e aplica os dados dos indicadores ativos.
    const refresh = () => {
      const data = candleArrayRef.current
      if (!data || data.length < 3) return
      try {
        if (S.ma9) S.ma9.setData(smaLine(data, 9))
        if (S.ma21) S.ma21.setData(smaLine(data, 21))
        if (S.bollM) {
          const b = bollingerLines(data, 20, 2)
          S.bollU.setData(b.upper)
          S.bollM.setData(b.mid)
          S.bollL.setData(b.lower)
        }
        if (S.macdHist) {
          const m = macdData(data, 12, 26, 9)
          S.macdHist.setData(m.hist)
          S.macdLine.setData(m.macd)
          S.macdSignal.setData(m.signal)
        }
        if (S.fractal && fractalMarkersApiRef.current) {
          S.fractal.setData(data.map((c) => ({ time: c.time as any, value: c.close })))
          fractalMarkersApiRef.current.setMarkers(fractalMarkers(data))
        }
      } catch {}
    }

    refresh()
    const anyOn = ind.ma || ind.boll || ind.fractal || ind.macd
    const id = anyOn ? setInterval(refresh, 500) : undefined
    return () => {
      if (id) clearInterval(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicators, seriesReady, symbol, timeframe])

  // ===== TRADE LINES (native price lines, attached to chart) =====
  //
  // BUG CORRIGIDO — "a linha de CALL/PUT sumia ao minimizar a pagina e voltar":
  //
  // 1. A existencia da linha dependia do estado `cds`, alimentado por um setInterval. Navegador
  //    estrangula (e chega a congelar) timers de aba em segundo plano, entao ao restaurar a
  //    janela o `cds` vinha vazio/velho: `cds[trade.id] ?? -1` dava -1, caia no `cd <= 0` e a
  //    linha NAO era desenhada. Agora o tempo restante e calculado na hora, direto de
  //    `trade.timestamp + trade.expiryTime`, que nao depende de nenhum timer ter rodado.
  // 2. O efeito apagava TODAS as linhas e recriava a cada tick (4x/s). Qualquer falha no meio
  //    (ou um tick com estado velho) deixava o grafico sem linha nenhuma. Agora e incremental:
  //    linha existente e so atualizada via applyOptions, e removemos apenas as que sairam.
  //
  // O `resyncKey` (visibilitychange/focus/pageshow) forca uma reconciliacao ao voltar para a
  // aba, e `linesSeriesRef` detecta troca de serie para descartar handles orfaos.
  useEffect(() => {
    const series = seriesRef.current
    const lwc = lwcRef.current
    if (!series) return

    // Se a serie foi recriada, os handles guardados apontam para um objeto morto: descarta.
    if (linesSeriesRef.current !== series) {
      tradeLinesRef.current.clear()
      linesSeriesRef.current = series
    }

    const LS = lwc?.LineStyle
    const now = Date.now()
    const seen = new Set<string>()

    chartTrades.forEach((trade) => {
      if (trade.entryPrice <= 0) return

      // Tempo restante calculado agora, sem depender do cronometro (que pode estar congelado).
      const cd = Math.max(0, Math.ceil((trade.timestamp + trade.expiryTime * 1000 - now) / 1000))
      if (cd <= 0) return

      const isCall = trade.direction === "call"
      const color = cd <= 10 ? "#FFC400" : isCall ? "#00E676" : "#FF5252"
      const label = isCall ? "CALL" : "PUT"
      const timeStr = `${String(Math.floor(cd / 60)).padStart(2, "0")}:${String(cd % 60).padStart(2, "0")}`
      const amount = trade.amount ? ` R$${trade.amount.toFixed(0)}` : ""
      const title = ` ${label} ${timeStr}${amount} `

      seen.add(trade.id)
      const existing = tradeLinesRef.current.get(trade.id)

      if (existing) {
        // Linha ja existe: apenas atualiza cor/cronometro, sem remover e recriar (sem piscar).
        try {
          existing.applyOptions({ price: trade.entryPrice, color, title })
          return
        } catch {
          // applyOptions falhou (handle invalido) — cai no caminho de recriar abaixo.
          tradeLinesRef.current.delete(trade.id)
        }
      }

      try {
        const line = series.createPriceLine({
          price: trade.entryPrice,
          color,
          lineWidth: 2,
          lineStyle: LS?.Dashed ?? 1,
          axisLabelVisible: true,
          title,
        })
        if (line) tradeLinesRef.current.set(trade.id, line)
      } catch {}

      // Nenhum marcador e desenhado no candle da entrada, por escolha do usuario: a seta grande
      // (arrowUp/arrowDown) cobria os candles vizinhos e o ponto que a substituiu continuava
      // poluindo o grafico. A entrada segue identificada pela linha tracejada de preco acima,
      // que ja traz direcao, cor, cronometro e valor.
    })

    // Remove apenas as linhas de operacoes que expiraram ou sairam da lista.
    tradeLinesRef.current.forEach((line, id) => {
      if (seen.has(id)) return
      try {
        series.removePriceLine(line)
      } catch {}
      tradeLinesRef.current.delete(id)
    })
  }, [chartTrades, seriesReady, resyncKey])

  // ===== Live floating P&L overlays (IQ Option style) =====
  useEffect(() => {
    if (!chartTrades.length) {
      pnlSigRef.current = ""
      setPnlOverlays([])
      return
    }
    const payoutFrac = payout > 1 ? payout / 100 : payout
    const update = () => {
      const series = seriesRef.current
      if (!series) return
      const price = smoothPriceRef.current || latest.current.currentPrice
      const now = Date.now()
      const next: PnlOverlay[] = []
      chartTrades.forEach((t) => {
        if (t.entryPrice <= 0) return
        const remaining = Math.max(0, Math.ceil((t.timestamp + t.expiryTime * 1000 - now) / 1000))
        if (remaining <= 0) return
        let y: number | null = null
        try {
          y = series.priceToCoordinate(t.entryPrice)
        } catch {}
        if (y == null) return
        const isCall = t.direction === "call"
        // In binary options the result is "in the money" or not (tie counts as loss)
        const inMoney = isCall ? price > t.entryPrice : price < t.entryPrice
        const amount = t.amount || 10
        const pnl = inMoney ? Math.round(amount * payoutFrac * 100) / 100 : -amount
        const m = Math.floor(remaining / 60)
        const s = remaining % 60
        next.push({
          id: t.id,
          top: y,
          pnl,
          inMoney,
          isCall,
          time: `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`,
        })
      })
      // So re-renderiza quando algo realmente muda. A cada tick os valores costumam ser
      // identicos (o tempo so muda 1x/s, a coordenada Y quase nao varia, o P&L raramente vira),
      // entao comparar uma assinatura evita dezenas de re-renders por segundo do componente.
      const sig = next.map((o) => `${o.id}:${Math.round(o.top)}:${o.pnl}:${o.inMoney ? 1 : 0}:${o.time}`).join("|")
      if (sig === pnlSigRef.current) return
      pnlSigRef.current = sig
      setPnlOverlays(next)
    }
    update()
    const iv = setInterval(update, 120)
    return () => clearInterval(iv)
  }, [chartTrades, payout, seriesReady])

  // ===== Preview de direcao no hover de Comprar/Vender =====
  // Acompanha a altura do preco atual enquanto o mouse esta sobre um dos botoes, para que a
  // faixa colorida e a linha tracejada fiquem colados no preco mesmo com o grafico se movendo.
  useEffect(() => {
    if (!hoverDirection) {
      setHoverGeom(null)
      return
    }
    const measure = () => {
      const series = seriesRef.current
      const chart = chartRef.current
      if (!series) return
      const price = smoothPriceRef.current || latest.current.currentPrice
      let y: number | null = null
      try {
        const c = series.priceToCoordinate(price)
        if (typeof c === "number" && Number.isFinite(c)) y = c
      } catch {}
      if (y == null) return
      let axis = 62
      try {
        const w = chart?.priceScale("right")?.width?.()
        if (typeof w === "number" && Number.isFinite(w) && w > 0) axis = w
      } catch {}
      setHoverGeom((prev) =>
        prev && Math.abs(prev.y - y!) < 0.5 && prev.axis === axis ? prev : { y: y!, axis },
      )
    }
    measure()
    const iv = setInterval(measure, 60)
    return () => clearInterval(iv)
  }, [hoverDirection, seriesReady])

  // Realca a linha do preco atual na cor da direcao enquanto o botao esta sob o mouse.
  useEffect(() => {
    const series = seriesRef.current
    if (!series) return
    try {
      series.applyOptions({
        priceLineColor: hoverDirection === "call" ? "#00E676" : hoverDirection === "put" ? "#FF5252" : "#787B86",
        priceLineStyle: hoverDirection ? 2 : 0,
      })
    } catch {}
  }, [hoverDirection, seriesReady])

  return (
    <div className="relative w-full h-full overflow-hidden" style={{ backgroundColor: "#0d0d0f" }}>
      {/* Marca d'agua URYN BROKER no fundo do grafico */}
      <div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: "url(/images/urynbroker-watermark.png)",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center 45%",
          backgroundSize: "55% auto",
          opacity: 0.1,
        }}
      />
      {/* Vinheta sutil para dar profundidade */}
      <div
        className="absolute inset-0 z-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at center, rgba(13,13,15,0) 55%, rgba(13,13,15,0.85) 100%)",
        }}
      />
      {/* OHLC header */}
      <div
        ref={headerRef}
        className="absolute top-2 left-3 z-20 flex items-center pointer-events-none"
        style={{ fontFamily: "'SF Mono',Consolas,monospace" }}
      />

      {/* Contador regressivo do fechamento da vela (estilo IQ Option) */}
      <div
        ref={countdownRef}
        className="absolute right-[62px] z-20 rounded px-1.5 py-0.5 text-[11px] font-bold tabular-nums pointer-events-none"
        style={{
          top: "50%",
          transform: "translateY(-50%)",
          fontFamily: "'SF Mono',Consolas,monospace",
          opacity: 0,
        }}
      />

      {/* Chart container - touchAction none lets the chart capture drag instead of the page scrolling */}
      <div ref={containerRef} className="absolute inset-0 z-10" style={{ touchAction: "none" }} />

      {/* Camada de desenho (marcacoes) - so captura eventos quando uma ferramenta esta ativa */}
      <canvas
        ref={drawCanvasRef}
        className="absolute inset-0 z-[15]"
        style={{
          touchAction: "none",
          pointerEvents: tool === "cursor" ? "none" : "auto",
          cursor: tool === "eraser" ? "not-allowed" : tool === "cursor" ? "default" : "crosshair",
        }}
        onPointerDown={handleDrawPointerDown}
        onPointerMove={handleDrawPointerMove}
        onPointerUp={handleDrawPointerUp}
      />

      {/* Preview da direcao no hover: tinge a metade do grafico onde a operacao daria lucro */}
      {hoverDirection && hoverGeom && (
        <div
          className="absolute inset-0 z-[16] pointer-events-none"
          style={{ right: `${hoverGeom.axis}px`, animation: "hoverDirFade 180ms ease-out" }}
          aria-hidden="true"
        >
          {/* Faixa tingida, esmaecendo conforme se afasta do preco de entrada */}
          <div
            className="absolute left-0 right-0"
            style={
              hoverDirection === "call"
                ? {
                    top: 0,
                    height: `${Math.max(0, hoverGeom.y)}px`,
                    background: "linear-gradient(to top, rgba(0,230,118,0.20), rgba(0,230,118,0.02))",
                  }
                : {
                    top: `${Math.max(0, hoverGeom.y)}px`,
                    bottom: 0,
                    background: "linear-gradient(to bottom, rgba(255,82,82,0.20), rgba(255,82,82,0.02))",
                  }
            }
          />
          {/* Linha tracejada no preco atual */}
          <div
            className="absolute left-0 right-0"
            style={{
              top: `${hoverGeom.y}px`,
              borderTop: `1px dashed ${hoverDirection === "call" ? "#00E676" : "#FF5252"}`,
              opacity: 0.9,
            }}
          />
          {/* Seta indicando o sentido da aposta */}
          <div
            className="absolute right-1 flex items-center justify-center"
            style={{
              top: `${hoverGeom.y}px`,
              transform: hoverDirection === "call" ? "translateY(-115%)" : "translateY(15%)",
              color: hoverDirection === "call" ? "#00E676" : "#FF5252",
            }}
          >
            <svg
              style={{ animation: "hoverDirArrow 900ms ease-in-out infinite" }}
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {hoverDirection === "call" ? (
                <>
                  <path d="M5 17 L19 5" />
                  <path d="M13 5 h6 v6" />
                </>
              ) : (
                <>
                  <path d="M5 5 L19 17" />
                  <path d="M19 11 v6 h-6" />
                </>
              )}
            </svg>
          </div>
        </div>
      )}

      {/* Barra de ferramentas de desenho (estilo IQ Option) */}
      <div className="absolute top-1/2 left-2 z-30 -translate-y-1/2 flex flex-col items-center gap-1 rounded-xl border border-[#2A2E39] bg-[#0d0d0f]/90 p-1 backdrop-blur-sm">
        {DRAW_TOOLS.map((dt) => {
          const active = tool === dt.id
          return (
            <button
              key={dt.id}
              type="button"
              title={dt.label}
              aria-label={dt.label}
              onClick={() => setTool(active && dt.id !== "cursor" ? "cursor" : dt.id)}
              className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
              style={{
                backgroundColor: active ? "#f97316" : "transparent",
                color: active ? "#fff" : "#94A3B8",
              }}
            >
              {dt.icon}
            </button>
          )
        })}

        <div className="my-0.5 h-px w-6 bg-[#2A2E39]" />

        {/* Seletor de cor */}
        <div className="relative">
          <button
            type="button"
            title="Cor"
            aria-label="Selecionar cor"
            onClick={() => setShowColors((s) => !s)}
            className="flex h-8 w-8 items-center justify-center rounded-lg"
          >
            <span className="h-4 w-4 rounded-full border border-white/30" style={{ backgroundColor: drawColor }} />
          </button>
          {showColors && (
            <div className="absolute left-10 top-0 flex gap-1 rounded-lg border border-[#2A2E39] bg-[#0d0d0f] p-1.5">
              {DRAW_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Cor ${c}`}
                  onClick={() => {
                    setDrawColor(c)
                    setShowColors(false)
                  }}
                  className="h-5 w-5 rounded-full border transition-transform hover:scale-110"
                  style={{ backgroundColor: c, borderColor: c === drawColor ? "#fff" : "transparent" }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Limpar tudo */}
        <button
          type="button"
          title="Limpar tudo"
          aria-label="Limpar todas as marcacoes"
          onClick={() => {
            setDrawings([])
            draftRef.current = null
          }}
          disabled={drawings.length === 0}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[#94A3B8] transition-colors hover:text-[#FF5252] disabled:opacity-30"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
        </button>

        <div className="my-0.5 h-px w-6 bg-[#2A2E39]" />

        {/* Indicadores tecnicos */}
        <div className="relative">
          <button
            type="button"
            title="Indicadores"
            aria-label="Indicadores tecnicos"
            onClick={() => setShowIndicators((s) => !s)}
            className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors"
            style={{
              backgroundColor: indicators.ma || indicators.boll || indicators.fractal || indicators.macd ? "#f97316" : "transparent",
              color: indicators.ma || indicators.boll || indicators.fractal || indicators.macd ? "#fff" : "#94A3B8",
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 3v18h18" />
              <path d="m7 14 3-4 3 3 4-6" />
            </svg>
          </button>
          {showIndicators && (
            <div className="absolute left-10 top-0 w-52 rounded-xl border border-[#2A2E39] bg-[#0d0d0f] p-1.5 shadow-xl">
              {(
                [
                  { key: "ma", label: "Médias Móveis", desc: "SMA 9 / 21", color: "#FFC400" },
                  { key: "boll", label: "Bandas de Bollinger", desc: "20, 2", color: "#fb923c" },
                  { key: "fractal", label: "Fractais", desc: "Bill Williams", color: "#38bdf8" },
                  { key: "macd", label: "MACD", desc: "12, 26, 9", color: "#00E676" },
                ] as const
              ).map((it) => {
                const on = indicators[it.key]
                return (
                  <button
                    key={it.key}
                    type="button"
                    onClick={() => setIndicators((prev) => ({ ...prev, [it.key]: !prev[it.key] }))}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-white/5"
                  >
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: it.color }} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-white">{it.label}</span>
                      <span className="block text-[10px] text-[#787B86]">{it.desc}</span>
                    </span>
                    <span
                      className="flex h-4 w-7 shrink-0 items-center rounded-full p-0.5 transition-colors"
                      style={{ backgroundColor: on ? "#f97316" : "#2A2E39" }}
                    >
                      <span
                        className="h-3 w-3 rounded-full bg-white transition-transform"
                        style={{ transform: on ? "translateX(12px)" : "translateX(0)" }}
                      />
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Relogio minimizado (UTC-3) no canto inferior esquerdo */}
      {clock && (
        <div
          className="absolute bottom-2 left-3 z-20 pointer-events-none flex items-center gap-1"
          style={{ fontFamily: "'SF Mono',Consolas,monospace" }}
        >
          <span className="w-1 h-1 rounded-full bg-[#00E676]" />
          <span className="text-[10px] font-medium text-[#787B86] tabular-nums tracking-tight">
            {clock} UTC-3
          </span>
        </div>
      )}

      {/* Live floating P&L above each open operation */}
      {pnlOverlays.map((o) => {
        const clr = o.inMoney ? "#00E676" : "#FF5252"
        return (
          <div
            key={o.id}
            className="absolute z-20 pointer-events-none"
            style={{
              top: o.top,
              right: 72,
              transform: "translateY(-50%)",
              transition: "top 0.12s linear",
            }}
          >
            <div
              className="flex flex-col items-end gap-0.5"
              style={{ animation: "pnlPop 0.3s ease-out" }}
            >
              <div
                className="px-2 py-1 rounded-md font-bold text-xs whitespace-nowrap"
                style={{
                  background: "rgba(13,13,15,0.92)",
                  color: clr,
                  border: `1px solid ${clr}`,
                  boxShadow: `0 0 10px ${clr}55`,
                  fontFamily: "'SF Mono',Consolas,monospace",
                }}
              >
                {o.pnl >= 0 ? "+" : "-"}R${" "}
                {Math.abs(o.pnl).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div
                className="px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap"
                style={{
                  background: "rgba(13,13,15,0.85)",
                  color: o.isCall ? "#00E676" : "#FF5252",
                  fontFamily: "'SF Mono',Consolas,monospace",
                }}
              >
                {o.time}
              </div>
            </div>
          </div>
        )
      })}

      {/* Loading */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center z-30" style={{ backgroundColor: "#0d0d0f" }}>
          <div className="flex flex-col items-center gap-3">
            <div
              className="w-8 h-8 rounded-full border-2 border-[#1a1a1e] border-t-[#00E676] animate-spin"
              aria-hidden
            />
            <span className="text-[#787B86] text-xs">Carregando grafico...</span>
          </div>
        </div>
      )}

      {/* Buy/Sell flash animation */}
      {flash && (
        <div
          key={flash.id}
          className="absolute inset-0 z-10 pointer-events-none"
          style={{
            background: `radial-gradient(circle at center, ${flash.dir === "call" ? "rgba(0,230,118,0.25)" : "rgba(255,82,82,0.25)"} 0%, transparent 60%)`,
            animation: "chartFlash 0.7s ease-out forwards",
          }}
        />
      )}

      <style>{`
        @keyframes chartFlash {
          0% { opacity: 0; }
          25% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes pnlPop {
          0% { transform: scale(0.7); opacity: 0; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes hoverDirFade {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
        @keyframes hoverDirArrow {
          0%, 100% { transform: translateX(0); }
          50% { transform: translateX(3px); }
        }
      `}</style>
    </div>
  )
}

// Comparador do memo: o grafico anima-se sozinho num rAF de 60fps que le o preco vivo DIRETO
// do motor (multiAssetEngine.getCurrentPrice) e as barras do datafeed — por isso `currentPrice`
// e `candles` sao apenas fallback e NAO precisam disparar re-render do React. Ignora-los aqui
// impede que este componente de ~2100 linhas (com useMemo de indicadores) reconcilie ~10x/s
// junto com o tick de preco da pagina, que era a causa da sensacao de "travado".
// So re-renderiza quando muda algo que o React realmente precisa aplicar na serie/overlays.
function marketChartPropsEqual(prev: Props, next: Props) {
  if (
    prev.symbol !== next.symbol ||
    prev.timeframe !== next.timeframe ||
    prev.reloadKey !== next.reloadKey ||
    prev.payout !== next.payout ||
    prev.hoverDirection !== next.hoverDirection
  ) {
    return false
  }
  const a = prev.activeTrades || []
  const b = next.activeTrades || []
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    if (
      a[i].id !== b[i].id ||
      a[i].symbol !== b[i].symbol ||
      a[i].entryPrice !== b[i].entryPrice ||
      a[i].direction !== b[i].direction ||
      a[i].expiryTime !== b[i].expiryTime ||
      a[i].timestamp !== b[i].timestamp
    ) {
      return false
    }
  }
  return true
}

export const MarketChart = memo(function MarketChart(props: Props) {
  return (
    <ChartErrorBoundary>
      <ChartCore {...props} />
    </ChartErrorBoundary>
  )
}, marketChartPropsEqual)
