"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { OTC_ASSETS } from "@/lib/price-engine/multi-asset-engine"
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Zap,
  Clock,
  Trash2,
  Square,
  Search,
  Activity,
} from "lucide-react"

// A autorizacao do painel e feita por cookie HttpOnly assinado, enviado automaticamente
// pelo navegador em requisicoes same-origin. Nenhum segredo trafega pelo bundle.
const ADMIN_TOKEN = ""

const TIMEFRAMES = [
  { value: 60, label: "1m" },
  { value: 300, label: "5m" },
  { value: 600, label: "10m" },
]

// Estilos de candle: como o movimento aparece no grafico (parecer real, nao manipulado).
const STYLES = [
  { value: "natural", label: "Realista", desc: "Vai contra, corrige e fecha na direcao" },
  { value: "suave", label: "Suave", desc: "Caminho limpo, correcoes curtas" },
  { value: "forte", label: "Forte", desc: "Pullbacks rasos, chegada decidida" },
  { value: "volatil", label: "Volatil", desc: "Chicoteia muito antes de entregar a direcao" },
]

function styleLabel(v: string) {
  return STYLES.find((s) => s.value === v)?.label || "Realista"
}

// Somente ativos OTC (os sinteticos, que passam pelo motor manipulavel).
const OTC_ONLY = OTC_ASSETS.filter((a) => a.symbol.endsWith("_OTC"))

interface Manipulation {
  id: string
  symbol: string
  direction: "up" | "down"
  timeframe: number
  start_time: string
  end_time: string
  duration_candles: number
  strength: number
  style: string
  active: boolean
  created_at: string
}

function tfLabel(tf: number) {
  return TIMEFRAMES.find((t) => t.value === tf)?.label || `${tf}s`
}

function assetName(symbol: string) {
  return OTC_ASSETS.find((a) => a.symbol === symbol)?.name || symbol
}

export function AdminManipulation() {
  const [list, setList] = useState<Manipulation[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nowTick, setNowTick] = useState(Date.now())

  // Form state
  const [symbol, setSymbol] = useState(OTC_ONLY[0]?.symbol || "EURUSD_OTC")
  const [assetSearch, setAssetSearch] = useState("")
  const [direction, setDirection] = useState<"up" | "down">("up")
  const [style, setStyle] = useState("natural")
  const [timeframe, setTimeframe] = useState(60)
  const [mode, setMode] = useState<"now" | "scheduled">("now")
  const [startAt, setStartAt] = useState("")
  const [durationCandles, setDurationCandles] = useState(3)
  const [strength, setStrength] = useState(70)

  const fetchList = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/manipulations", { headers: { "x-admin-token": ADMIN_TOKEN } })
      const data = await res.json()
      if (res.ok) setList(data.manipulations || [])
    } catch (e) {
      console.error("[v0] erro ao carregar manipulacoes", e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchList()
  }, [])

  // Relogio para status/contagem regressiva.
  useEffect(() => {
    const t = setInterval(() => setNowTick(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const filteredAssets = useMemo(() => {
    const q = assetSearch.trim().toLowerCase()
    if (!q) return OTC_ONLY
    return OTC_ONLY.filter(
      (a) => a.name.toLowerCase().includes(q) || a.symbol.toLowerCase().includes(q),
    )
  }, [assetSearch])

  const durationSeconds = durationCandles * timeframe
  const durationLabel =
    durationSeconds >= 60 ? `${Math.round((durationSeconds / 60) * 10) / 10} min` : `${durationSeconds}s`

  const createManipulation = async () => {
    setError(null)
    if (mode === "scheduled" && !startAt) {
      setError("Escolha o horario de inicio para agendar.")
      return
    }
    setCreating(true)
    try {
      const res = await fetch("/api/admin/manipulations", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": ADMIN_TOKEN },
        body: JSON.stringify({
          symbol,
          direction,
          style,
          timeframe,
          mode,
          startAt: mode === "scheduled" ? new Date(startAt).toISOString() : undefined,
          durationCandles,
          strength,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Falha ao criar manipulacao.")
        return
      }
      await fetchList()
    } catch (e) {
      setError("Erro de rede ao criar manipulacao.")
    } finally {
      setCreating(false)
    }
  }

  const stopManipulation = async (id: string) => {
    setList((prev) => prev.map((m) => (m.id === id ? { ...m, active: false } : m)))
    try {
      await fetch(`/api/admin/manipulations?id=${id}`, {
        method: "DELETE",
        headers: { "x-admin-token": ADMIN_TOKEN },
      })
    } catch {}
    fetchList()
  }

  const deleteManipulation = async (id: string) => {
    setList((prev) => prev.filter((m) => m.id !== id))
    try {
      await fetch(`/api/admin/manipulations?id=${id}&hard=1`, {
        method: "DELETE",
        headers: { "x-admin-token": ADMIN_TOKEN },
      })
    } catch {}
    fetchList()
  }

  const statusOf = (m: Manipulation) => {
    const now = nowTick
    const start = new Date(m.start_time).getTime()
    const end = new Date(m.end_time).getTime()
    if (!m.active) return { key: "stopped", label: "Encerrada", color: "text-gray-500 bg-gray-500/10" }
    if (now < start) return { key: "scheduled", label: "Agendada", color: "text-blue-400 bg-blue-500/10" }
    if (now > end) return { key: "done", label: "Concluida", color: "text-gray-500 bg-gray-500/10" }
    return { key: "active", label: "Ativa", color: "text-emerald-400 bg-emerald-500/10" }
  }

  const remainingLabel = (m: Manipulation) => {
    const now = nowTick
    const start = new Date(m.start_time).getTime()
    const end = new Date(m.end_time).getTime()
    let secs = 0
    let prefix = ""
    if (now < start) {
      secs = Math.round((start - now) / 1000)
      prefix = "Inicia em "
    } else if (now <= end) {
      secs = Math.round((end - now) / 1000)
      prefix = "Termina em "
    } else {
      return "Finalizada"
    }
    const m2 = Math.floor(secs / 60)
    const s = secs % 60
    return `${prefix}${m2 > 0 ? `${m2}m ` : ""}${s}s`
  }

  const activeCount = list.filter((m) => {
    const s = statusOf(m)
    return s.key === "active" || s.key === "scheduled"
  }).length

  const selectedAsset = OTC_ASSETS.find((a) => a.symbol === symbol)

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-orange-500" />
            <h1 className="text-2xl font-bold tracking-tight text-white">Manipulacao</h1>
          </div>
          <p className="mt-1 text-sm text-gray-400">
            Force a direcao dos candles de qualquer ativo OTC. {activeCount} ativa(s)/agendada(s).
          </p>
        </div>
        <Button
          onClick={fetchList}
          variant="outline"
          size="sm"
          className="border-white/[0.06] bg-[#0c121c] text-gray-300 hover:bg-[#141c2b] hover:text-white"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,420px)_1fr]">
        {/* Painel de criacao */}
        <div className="rounded-2xl border border-white/[0.08] bg-[#0c121c] p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-gray-400">Nova manipulacao</h2>

          {/* Ativo */}
          <label className="mb-1.5 block text-xs font-medium text-gray-400">Ativo OTC</label>
          <div className="relative mb-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <input
              placeholder="Buscar ativo..."
              value={assetSearch}
              onChange={(e) => setAssetSearch(e.target.value)}
              className="h-9 w-full rounded-lg border border-white/[0.06] bg-[#0a0e16] pl-9 pr-3 text-sm text-white outline-none placeholder:text-gray-500 focus:border-white/20"
            />
          </div>
          <div className="mb-4 max-h-40 overflow-auto rounded-lg border border-white/[0.06] bg-[#0a0e16]">
            {filteredAssets.map((a) => (
              <button
                key={a.symbol}
                onClick={() => setSymbol(a.symbol)}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition-colors ${
                  symbol === a.symbol ? "bg-orange-500/15 text-orange-400" : "text-gray-300 hover:bg-white/[0.04]"
                }`}
              >
                <span className="truncate">{a.name}</span>
                <span className="ml-2 shrink-0 text-xs text-gray-600">{a.symbol}</span>
              </button>
            ))}
            {filteredAssets.length === 0 && (
              <p className="px-3 py-4 text-center text-xs text-gray-500">Nenhum ativo.</p>
            )}
          </div>

          {/* Direcao */}
          <label className="mb-1.5 block text-xs font-medium text-gray-400">Direcao dos candles</label>
          <div className="mb-4 grid grid-cols-2 gap-2">
            <button
              onClick={() => setDirection("up")}
              className={`flex items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-semibold transition-all ${
                direction === "up"
                  ? "border-emerald-500 bg-emerald-500/15 text-emerald-400"
                  : "border-white/[0.06] bg-[#0a0e16] text-gray-400 hover:text-gray-200"
              }`}
            >
              <TrendingUp className="h-4 w-4" /> Alta
            </button>
            <button
              onClick={() => setDirection("down")}
              className={`flex items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-semibold transition-all ${
                direction === "down"
                  ? "border-red-500 bg-red-500/15 text-red-400"
                  : "border-white/[0.06] bg-[#0a0e16] text-gray-400 hover:text-gray-200"
              }`}
            >
              <TrendingDown className="h-4 w-4" /> Baixa
            </button>
          </div>

          {/* Estilo dos candles */}
          <label className="mb-1.5 block text-xs font-medium text-gray-400">Estilo dos candles</label>
          <div className="mb-1 grid grid-cols-2 gap-2">
            {STYLES.map((s) => (
              <button
                key={s.value}
                onClick={() => setStyle(s.value)}
                className={`rounded-lg border px-3 py-2 text-left text-sm font-semibold transition-all ${
                  style === s.value
                    ? "border-orange-500 bg-orange-500/15 text-orange-400"
                    : "border-white/[0.06] bg-[#0a0e16] text-gray-400 hover:text-gray-200"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <p className="mb-4 text-[11px] leading-relaxed text-gray-500">
            {STYLES.find((s) => s.value === style)?.desc}
          </p>

          {/* Tempo grafico */}
          <label className="mb-1.5 block text-xs font-medium text-gray-400">Tempo do candle</label>
          <div className="mb-4 grid grid-cols-3 gap-2">
            {TIMEFRAMES.map((t) => (
              <button
                key={t.value}
                onClick={() => setTimeframe(t.value)}
                className={`rounded-lg border py-2 text-sm font-semibold transition-all ${
                  timeframe === t.value
                    ? "border-orange-500 bg-orange-500/15 text-orange-400"
                    : "border-white/[0.06] bg-[#0a0e16] text-gray-400 hover:text-gray-200"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Momento */}
          <label className="mb-1.5 block text-xs font-medium text-gray-400">Quando aplicar</label>
          <div className="mb-3 grid grid-cols-2 gap-2">
            <button
              onClick={() => setMode("now")}
              className={`flex items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-semibold transition-all ${
                mode === "now"
                  ? "border-orange-500 bg-orange-500/15 text-orange-400"
                  : "border-white/[0.06] bg-[#0a0e16] text-gray-400 hover:text-gray-200"
              }`}
            >
              <Zap className="h-4 w-4" /> Agora
            </button>
            <button
              onClick={() => setMode("scheduled")}
              className={`flex items-center justify-center gap-2 rounded-lg border py-2.5 text-sm font-semibold transition-all ${
                mode === "scheduled"
                  ? "border-orange-500 bg-orange-500/15 text-orange-400"
                  : "border-white/[0.06] bg-[#0a0e16] text-gray-400 hover:text-gray-200"
              }`}
            >
              <Clock className="h-4 w-4" /> Agendar
            </button>
          </div>
          {mode === "scheduled" && (
            <input
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              className="mb-4 h-10 w-full rounded-lg border border-white/[0.06] bg-[#0a0e16] px-3 text-sm text-white outline-none focus:border-white/20 [color-scheme:dark]"
            />
          )}
          {mode === "now" && <div className="mb-1" />}

          {/* Duracao em candles */}
          <label className="mb-1.5 block text-xs font-medium text-gray-400">
            Duracao: {durationCandles} candle(s) &middot; {durationLabel}
          </label>
          <input
            type="range"
            min={1}
            max={30}
            value={durationCandles}
            onChange={(e) => setDurationCandles(Number(e.target.value))}
            className="mb-4 w-full accent-orange-500"
          />

          {/* Forca */}
          <label className="mb-1.5 block text-xs font-medium text-gray-400">Intensidade: {strength}%</label>
          <input
            type="range"
            min={10}
            max={100}
            value={strength}
            onChange={(e) => setStrength(Number(e.target.value))}
            className="mb-4 w-full accent-orange-500"
          />

          {error && (
            <div className="mb-3 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {error}
            </div>
          )}

          <Button
            onClick={createManipulation}
            disabled={creating}
            className={`w-full font-semibold text-white ${
              direction === "up" ? "bg-emerald-600 hover:bg-emerald-500" : "bg-red-600 hover:bg-red-500"
            }`}
          >
            {creating ? (
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            ) : direction === "up" ? (
              <TrendingUp className="mr-2 h-4 w-4" />
            ) : (
              <TrendingDown className="mr-2 h-4 w-4" />
            )}
            Forcar {direction === "up" ? "ALTA" : "BAIXA"} em {selectedAsset?.name || symbol}
          </Button>
        </div>

        {/* Lista de manipulacoes */}
        <div>
          <div className="mb-3 flex items-center gap-2">
            <Activity className="h-4 w-4 text-gray-500" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">Manipulacoes</h2>
            <span className="text-xs text-gray-600">({list.length})</span>
          </div>

          {loading && list.length === 0 ? (
            <div className="flex items-center justify-center py-20 text-gray-500">
              <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> Carregando...
            </div>
          ) : list.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/[0.08] bg-[#0a0e16] py-16 text-center text-sm text-gray-500">
              Nenhuma manipulacao criada ainda.
            </div>
          ) : (
            <div className="space-y-3">
              {list.map((m) => {
                const st = statusOf(m)
                const isRunning = st.key === "active" || st.key === "scheduled"
                return (
                  <div
                    key={m.id}
                    className="flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-[#0c121c] p-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                          m.direction === "up" ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"
                        }`}
                      >
                        {m.direction === "up" ? (
                          <TrendingUp className="h-5 w-5" />
                        ) : (
                          <TrendingDown className="h-5 w-5" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-white">{assetName(m.symbol)}</p>
                          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${st.color}`}>
                            {st.label}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-gray-500">
                          {m.direction === "up" ? "Alta" : "Baixa"} &middot; {styleLabel(m.style)} &middot;{" "}
                          {tfLabel(m.timeframe)} &middot; {m.duration_candles} candle(s) &middot; forca {m.strength}%
                        </p>
                        <p className="mt-0.5 text-xs font-medium text-gray-400">
                          {isRunning ? remainingLabel(m) : "Encerrada"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      {isRunning && (
                        <button
                          onClick={() => stopManipulation(m.id)}
                          className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-[#0a0e16] px-3 py-1.5 text-xs font-medium text-gray-300 hover:bg-white/[0.04]"
                        >
                          <Square className="h-3.5 w-3.5" /> Parar
                        </button>
                      )}
                      <button
                        onClick={() => deleteManipulation(m.id)}
                        className="flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/20"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Excluir
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
