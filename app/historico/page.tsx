"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { ArrowLeft, TrendingUp, TrendingDown, Clock, Calendar } from "lucide-react"
import Link from "next/link"

interface Trade {
  id: string
  symbol: string
  direction: "CALL" | "PUT"
  amount: number
  entry_price: number
  exit_price: number | null
  timeframe: number
  payout_percentage: number
  result: "WIN" | "LOSS" | "PENDING"
  profit: number | null
  entry_time: string
  exit_time: string | null
  created_at: string
}

type FilterType = "all" | "WIN" | "LOSS" | "PENDING"

export default function HistoricoPage() {
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>("all")
  const [remainingTimes, setRemainingTimes] = useState<Record<string, number>>({})

  const supabase = createClient()

  useEffect(() => {
    fetchTrades()
  }, [])

  async function fetchTrades() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from("trades")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Error fetching trades:", error)
        return
      }

      if (data) {
        setTrades(data as Trade[])

        // Calculate stats
        const completedTrades = data.filter((t: Trade) => t.result !== "PENDING")
        const wins = completedTrades.filter((t: Trade) => t.result === "WIN").length
        const losses = completedTrades.filter((t: Trade) => t.result === "LOSS").length
        const totalProfit = completedTrades.reduce((sum: number, t: Trade) => sum + (t.profit || 0), 0)

        // Not setting stats here as they are removed
      }
    } catch (error) {
      console.error("Error:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const updateTimers = () => {
      const now = Date.now()
      const times: Record<string, number> = {}

      trades.forEach((trade) => {
        if (trade.result === "PENDING") {
          const expiryTime = new Date(trade.entry_time).getTime() + trade.timeframe * 1000
          const remaining = Math.max(0, Math.floor((expiryTime - now) / 1000))
          times[trade.id] = remaining
        }
      })

      setRemainingTimes(times)
    }

    if (trades.length > 0) {
      updateTimers()
      const interval = setInterval(updateTimers, 1000)
      return () => clearInterval(interval)
    }
  }, [trades])

  const filteredTrades = trades.filter((trade) => {
    if (filter === "all") return true
    return trade.result === filter
  })

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const formatPrice = (price: number, symbol: string) => {
    if (symbol.includes("JPY")) {
      return price.toFixed(3)
    }
    if (symbol.includes("BTC")) {
      return price.toFixed(2)
    }
    return price.toFixed(5)
  }

  return (
    <div className="min-h-screen bg-[#0a0a0c] text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#1a1a1f] border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-4">
          <Link href="/trade" className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-lg font-semibold">Histórico de Operações</h1>
        </div>
      </header>

      {/* Filter */}
      <div className="px-4 mb-4">
        <div className="flex items-center gap-2 bg-[#1a1a1f] rounded-xl p-1 border border-white/10">
          <button
            onClick={() => setFilter("all")}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              filter === "all" ? "bg-orange-600 text-white" : "text-white/60 hover:text-white"
            }`}
          >
            Todos
          </button>
          <button
            onClick={() => setFilter("WIN")}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              filter === "WIN" ? "bg-green-600 text-white" : "text-white/60 hover:text-white"
            }`}
          >
            Vitórias
          </button>
          <button
            onClick={() => setFilter("LOSS")}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              filter === "LOSS" ? "bg-red-600 text-white" : "text-white/60 hover:text-white"
            }`}
          >
            Derrotas
          </button>
          <button
            onClick={() => setFilter("PENDING")}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
              filter === "PENDING" ? "bg-yellow-600 text-white" : "text-white/60 hover:text-white"
            }`}
          >
            Pendentes
          </button>
        </div>
      </div>

      {/* Trades List */}
      <div className="px-4 pb-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
          </div>
        ) : filteredTrades.length === 0 ? (
          <div className="text-center py-12">
            <Clock className="w-12 h-12 mx-auto text-white/20 mb-4" />
            <p className="text-white/60">Nenhuma operação encontrada</p>
            <Link href="/trade" className="mt-4 inline-block text-orange-500 hover:underline">
              Fazer primeira operação
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTrades.map((trade) => {
              const remainingTime = remainingTimes[trade.id] || 0
              const isPending = trade.result === "PENDING"

              return (
                <div
                  key={trade.id}
                  className={`bg-[#1a1a1f] rounded-xl p-4 border ${
                    isPending
                      ? "border-white/10"
                      : trade.result === "WIN"
                        ? "border-l-4 border-green-500 border-t border-r border-b border-white/10"
                        : "border-l-4 border-red-500 border-t border-r border-b border-white/10"
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          trade.direction === "CALL" ? "bg-orange-500/20" : "bg-red-500/20"
                        }`}
                      >
                        {trade.direction === "CALL" ? (
                          <TrendingUp className="w-5 h-5 text-orange-500" />
                        ) : (
                          <TrendingDown className="w-5 h-5 text-red-500" />
                        )}
                      </div>
                      <div>
                        <p className="font-semibold">{trade.symbol}</p>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-white/60">
                            {trade.direction === "CALL" ? "Compra" : "Venda"} • {trade.timeframe}s
                          </p>
                          {isPending && remainingTime > 0 && (
                            <div className="flex items-center gap-1 bg-yellow-500/20 px-2 py-0.5 rounded-full">
                              <Clock className="w-3 h-3 text-yellow-500" />
                              <span className="text-yellow-500 text-xs font-mono font-bold">
                                {Math.floor(remainingTime / 60)}:{String(remainingTime % 60).padStart(2, "0")}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div
                      className={`px-3 py-1 rounded-full text-xs font-bold ${
                        trade.result === "WIN"
                          ? "bg-orange-500 text-white"
                          : trade.result === "LOSS"
                            ? "bg-red-500 text-white"
                            : "bg-yellow-500/20 text-yellow-500"
                      }`}
                    >
                      {trade.result === "WIN" ? "WIN" : trade.result === "LOSS" ? "LOSS" : "AGUARDANDO"}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-white/40 text-xs">Investimento</p>
                      <p className="font-medium">{formatCurrency(trade.amount)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-white/40 text-xs">Resultado</p>
                      <p className={`font-medium ${(trade.profit || 0) >= 0 ? "text-orange-500" : "text-red-500"}`}>
                        {trade.profit !== null ? formatCurrency(trade.profit) : "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-white/40 text-xs">Preço Entrada</p>
                      <p className="font-mono text-xs">{formatPrice(trade.entry_price, trade.symbol)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-white/40 text-xs">Preço Saída</p>
                      <p className="font-mono text-xs">
                        {trade.exit_price ? formatPrice(trade.exit_price, trade.symbol) : "-"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2 text-xs text-white/40">
                    <Calendar className="w-3 h-3" />
                    {formatDate(trade.entry_time)}
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
