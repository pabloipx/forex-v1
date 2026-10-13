"use client"

import { useState, useEffect, useMemo } from "react"
import {
  CheckCircle,
  XCircle,
  RefreshCw,
  History,
  TrendingUp,
  TrendingDown,
  Loader2,
  Filter,
} from "lucide-react"

interface Trade {
  id: string
  user_id: string
  symbol: string
  direction: string
  amount: number
  payout_percentage: number
  result: string
  profit: number
  timeframe: number
  created_at: string
  is_demo: boolean
  is_manually_adjusted?: boolean
}

export function AffiliateTradeEditor() {
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [savingTradeId, setSavingTradeId] = useState<string | null>(null)
  const [filterResult, setFilterResult] = useState<"all" | "win" | "loss" | "pending">("all")

  useEffect(() => {
    loadMyTrades()
  }, [])

  const loadMyTrades = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/my-trades")
      const data = await res.json()
      if (data.trades) setTrades(data.trades)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  const saveTradeResult = async (trade: Trade, newResult: "win" | "loss") => {
    setSavingTradeId(trade.id)
    try {
      const res = await fetch("/api/my-trades", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tradeId: trade.id, newResult }),
      })
      const data = await res.json()
      if (data.success) {
        setTrades((prev) =>
          prev.map((t) => {
            if (t.id === trade.id) {
              const payout = t.payout_percentage || 0.95
              const pm = payout > 1 ? payout / 100 : payout
              const np = newResult === "win" ? Math.round(t.amount * pm * 100) / 100 : -t.amount
              return { ...t, result: newResult, profit: np, is_manually_adjusted: true }
            }
            return t
          }),
        )
      } else {
        alert("Erro: " + (data.error || "Erro desconhecido"))
      }
    } catch {
      alert("Erro ao salvar")
    } finally {
      setSavingTradeId(null)
    }
  }

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)

  const formatDate = (date: string) =>
    new Date(date).toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit",
      hour: "2-digit", minute: "2-digit",
    })

  // Filtered trades
  const filteredTrades = useMemo(() => {
    return trades.filter((t) => {
      if (filterResult !== "all" && t.result !== filterResult) return false
      return true
    })
  }, [trades, filterResult])

  // Stats
  const stats = useMemo(() => {
    const wins = trades.filter((t) => t.result === "win").length
    const losses = trades.filter((t) => t.result === "loss").length
    const pending = trades.filter((t) => t.result === "pending").length
    return { wins, losses, pending, total: trades.length }
  }, [trades])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-[#f97316] animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-white">Minhas Operacoes</h2>
          <p className="text-xs text-white/40">Altere resultados do seu historico</p>
        </div>
        <button
          onClick={loadMyTrades}
          className="text-white/40 hover:text-white text-xs flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-[#1F2933]"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2">
        <div className="p-2.5 rounded-lg bg-[#121826] border border-[#1F2933] text-center">
          <p className="text-white font-bold text-sm">{stats.total}</p>
          <p className="text-white/30 text-[10px]">Total</p>
        </div>
        <div className="p-2.5 rounded-lg bg-[#121826] border border-[#1F2933] text-center">
          <p className="text-[#26a69a] font-bold text-sm">{stats.wins}</p>
          <p className="text-white/30 text-[10px]">Acertos</p>
        </div>
        <div className="p-2.5 rounded-lg bg-[#121826] border border-[#1F2933] text-center">
          <p className="text-red-400 font-bold text-sm">{stats.losses}</p>
          <p className="text-white/30 text-[10px]">Erros</p>
        </div>
        <div className="p-2.5 rounded-lg bg-[#121826] border border-[#1F2933] text-center">
          <p className="text-amber-400 font-bold text-sm">{stats.pending}</p>
          <p className="text-white/30 text-[10px]">Pendentes</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 items-center">
        <Filter className="w-3.5 h-3.5 text-white/30" />
        <select
          value={filterResult}
          onChange={(e) => setFilterResult(e.target.value as any)}
          className="py-1.5 px-2.5 rounded-lg bg-[#121826] border border-[#1F2933] text-white text-xs outline-none"
        >
          <option value="all">Todos</option>
          <option value="win">Acertos</option>
          <option value="loss">Erros</option>
          <option value="pending">Pendentes</option>
        </select>
      </div>

      {/* Trades list */}
      <div className="rounded-xl bg-[#121826] border border-[#1F2933] overflow-hidden">
        {filteredTrades.length === 0 ? (
          <div className="p-8 text-center">
            <History className="w-8 h-8 text-[#1F2933] mx-auto mb-2" />
            <p className="text-white/40 text-sm">Nenhuma operacao encontrada</p>
          </div>
        ) : (
          <div className="max-h-[500px] overflow-y-auto divide-y divide-[#1F2933]">
            {filteredTrades.map((trade) => {
              const isSaving = savingTradeId === trade.id
              return (
                <div
                  key={trade.id}
                  className={`p-3 transition-colors ${trade.is_manually_adjusted ? "bg-amber-500/[0.03]" : ""} ${isSaving ? "opacity-50 pointer-events-none" : ""}`}
                >
                  {/* Row 1: symbol + direction + tags */}
                  <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                    <span className="text-white text-xs font-medium">{trade.symbol}</span>
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                        trade.direction === "call"
                          ? "bg-[#26a69a]/15 text-[#26a69a]"
                          : "bg-red-500/15 text-red-400"
                      }`}
                    >
                      {trade.direction === "call" ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                      {trade.direction === "call" ? "CALL" : "PUT"}
                    </span>
                    {trade.is_demo && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#f97316]/15 text-[#f97316]">DEMO</span>
                    )}
                    {trade.is_manually_adjusted && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">EDITADO</span>
                    )}
                  </div>

                  {/* Row 2: info + buttons */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-white/30 text-[11px]">
                        {formatDate(trade.created_at)} - {formatCurrency(trade.amount)}
                      </p>
                      <p className={`text-[11px] font-medium ${
                        trade.result === "win" ? "text-[#26a69a]" : trade.result === "loss" ? "text-red-400" : "text-amber-400"
                      }`}>
                        {trade.result === "win" ? "ACERTO" : trade.result === "loss" ? "ERRO" : "PENDENTE"}
                        <span className="text-white/20 ml-1">
                          ({trade.profit > 0 ? "+" : ""}{formatCurrency(trade.profit || 0)})
                        </span>
                      </p>
                    </div>

                    <div className="flex gap-1.5 shrink-0">
                      <button
                        onClick={() => saveTradeResult(trade, "win")}
                        disabled={isSaving}
                        className={`px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1 ${
                          trade.result === "win"
                            ? "bg-[#26a69a] text-white"
                            : "bg-white/[0.04] text-white/40 hover:bg-[#26a69a]/20 hover:text-[#26a69a] border border-[#1F2933]"
                        }`}
                      >
                        {isSaving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                        Acerto
                      </button>
                      <button
                        onClick={() => saveTradeResult(trade, "loss")}
                        disabled={isSaving}
                        className={`px-2 py-1.5 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1 ${
                          trade.result === "loss"
                            ? "bg-red-500 text-white"
                            : "bg-white/[0.04] text-white/40 hover:bg-red-500/20 hover:text-red-400 border border-[#1F2933]"
                        }`}
                      >
                        {isSaving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                        Erro
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
