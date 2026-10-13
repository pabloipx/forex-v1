"use client"

import { useEffect, useState, useMemo, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { ChevronLeft, TrendingUp, TrendingDown, Clock, DollarSign, BarChart3 } from "lucide-react"

interface Trade {
  id: string
  symbol: string
  direction: string
  amount: number
  entry_price: number
  exit_price: number | null
  profit: number | null
  result: string
  is_demo: boolean
  created_at: string
  entry_time: string
  exit_time: string | null
  timeframe: number
  payout_percentage: number
}

export default function TransactionsPage() {
  const router = useRouter()
  const [trades, setTrades] = useState<Trade[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<"all" | "real" | "demo">("all")

  const supabase = useMemo(
    () => createClient(),
    [],
  )

  const loadTrades = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.replace("/auth/login")
        return
      }

      let query = supabase
        .from("trades")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(100)

      if (filter === "real") {
        query = query.eq("is_demo", false)
      } else if (filter === "demo") {
        query = query.eq("is_demo", true)
      }

      const { data, error } = await query

      if (error) {
        console.error("[v0] Error loading trades:", error)
      }

      if (data) {
        setTrades(data)
      }
    } catch (err) {
      console.error("[v0] Error:", err)
    } finally {
      setLoading(false)
    }
  }, [filter, router, supabase])

  useEffect(() => {
    loadTrades()

    // Poll every 5 seconds to refresh trades (especially for pending → completed)
    const interval = setInterval(() => {
      loadTrades()
    }, 5000)

    return () => {
      clearInterval(interval)
    }
  }, [loadTrades])

  const formatSymbol = useCallback((symbol: string) => {
    const symbols: Record<string, { name: string; flag: string }> = {
      "EUR/USD": { name: "EUR/USD", flag: "🇪🇺" },
      "GBP/USD": { name: "GBP/USD", flag: "🇬🇧" },
      "USD/JPY": { name: "USD/JPY", flag: "🇯🇵" },
      "AUD/USD": { name: "AUD/USD", flag: "🇦🇺" },
      "BTC/USD": { name: "BTC/USD", flag: "₿" },
    }
    return symbols[symbol] || { name: symbol, flag: "📊" }
  }, [])

  const formatTime = useCallback((dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    })
  }, [])

  const groupedTrades = useMemo(() => {
    const groups: Record<string, Trade[]> = {}

    trades.forEach((trade) => {
      const date = new Date(trade.created_at).toLocaleDateString("pt-BR")
      if (!groups[date]) {
        groups[date] = []
      }
      groups[date].push(trade)
    })

    return groups
  }, [trades])

  const handleFilterChange = useCallback((newFilter: typeof filter) => {
    setFilter(newFilter)
  }, [])

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#0B0F14" }}>
      {/* Header */}
      <div
        className="sticky top-0 z-10 px-4 py-4 flex items-center gap-3 border-b border-[#1F2933]"
        style={{ backgroundColor: "#0B0F14" }}
      >
        <button onClick={() => router.back()} className="p-2 -ml-2 active:opacity-70">
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>
        <h1 className="text-xl font-bold text-white">Histórico de Trades</h1>
      </div>

      {/* Filter */}
      <div className="px-4 py-4 border-b border-[#1F2933]">
        <div className="flex gap-2">
          {[
            { key: "all", label: "Todas" },
            { key: "real", label: "Real" },
            { key: "demo", label: "Demo" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => handleFilterChange(f.key as typeof filter)}
              className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all ${
                filter === f.key
                  ? "bg-[#f97316] text-white shadow-lg shadow-[#f97316]/20"
                  : "bg-[#1A2332] text-[#9CA3AF] hover:bg-[#243040]"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Trades List */}
      <div className="px-4 pb-8">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-2 border-[#f97316] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : trades.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#1A2332] flex items-center justify-center">
              <BarChart3 className="w-8 h-8 text-[#4B5563]" />
            </div>
            <p className="text-[#6B7280] text-lg">Nenhum trade encontrado</p>
            <p className="text-[#4B5563] text-sm mt-1">Comece a operar para ver seu histórico</p>
          </div>
        ) : (
          <div className="space-y-6 mt-4">
            {Object.entries(groupedTrades).map(([date, dayTrades]) => (
              <div key={date}>
                {/* Date Header */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-sm font-medium text-[#6B7280]">{date}</span>
                  <div className="flex-1 h-px bg-[#1F2933]" />
                  <span className="text-xs text-[#4B5563]">{dayTrades.length} trades</span>
                </div>

                {/* Trades for this date */}
                <div className="space-y-2">
                  {dayTrades.map((trade) => {
                    const symbolInfo = formatSymbol(trade.symbol)
                    const isCall = trade.direction?.toUpperCase() === "CALL"
                    const isWin = trade.result === "win"
                    const isLoss = trade.result === "loss"
                    const isPending = trade.result === "pending"

                    return (
                      <div key={trade.id} className="rounded-xl overflow-hidden" style={{ backgroundColor: "#1A2332" }}>
                        {/* Main Row */}
                        <div className="p-4 flex items-center gap-3">
                          {/* Direction Icon */}
                          <div
                            className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                              isCall ? "bg-[#f97316]/20" : "bg-[#EF4444]/20"
                            }`}
                          >
                            {isCall ? (
                              <TrendingUp className="w-6 h-6 text-[#f97316]" />
                            ) : (
                              <TrendingDown className="w-6 h-6 text-[#EF4444]" />
                            )}
                          </div>

                          {/* Trade Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-lg">{symbolInfo.flag}</span>
                              <span className="text-white font-semibold">{symbolInfo.name}</span>
                              {trade.is_demo && (
                                <span className="px-2 py-0.5 text-[10px] font-medium bg-[#374151] text-[#9CA3AF] rounded-full">
                                  DEMO
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-[#6B7280]">
                              <span className={`font-medium ${isCall ? "text-[#f97316]" : "text-[#EF4444]"}`}>
                                {isCall ? "COMPRA" : "VENDA"}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatTime(trade.entry_time || trade.created_at)}
                              </span>
                              <span>{trade.timeframe}m</span>
                            </div>
                          </div>

                          {/* Result & Amount */}
                          <div className="text-right">
                            <div className="flex items-center justify-end gap-2 mb-1">
                              {isPending ? (
                                <span className="px-2 py-1 text-xs font-semibold bg-[#F59E0B]/20 text-[#F59E0B] rounded-lg">
                                  ABERTO
                                </span>
                              ) : isWin ? (
                                <span className="px-2 py-1 text-xs font-semibold bg-[#f97316]/20 text-[#f97316] rounded-lg">
                                  VITÓRIA
                                </span>
                              ) : (
                                <span className="px-2 py-1 text-xs font-semibold bg-[#EF4444]/20 text-[#EF4444] rounded-lg">
                                  DERROTA
                                </span>
                              )}
                            </div>
                            <div className="flex items-center justify-end gap-1">
                              <DollarSign className="w-3 h-3 text-[#6B7280]" />
                              <span className="text-white font-medium">R$ {trade.amount.toFixed(2)}</span>
                            </div>
                            {trade.profit !== null && trade.profit !== 0 && (
                              <p
                                className={`text-xs font-semibold mt-1 ${trade.profit >= 0 ? "text-[#f97316]" : "text-[#EF4444]"}`}
                              >
                                {trade.profit >= 0 ? "+" : ""}R$ {trade.profit.toFixed(2)}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Price Details Bar */}
                        <div className="px-4 py-2 bg-[#0F1620] flex items-center justify-between text-xs">
                          <div className="flex items-center gap-4">
                            <span className="text-[#6B7280]">
                              Entrada: <span className="text-white">{trade.entry_price?.toFixed(5)}</span>
                            </span>
                            {trade.exit_price && (
                              <span className="text-[#6B7280]">
                                Saída: <span className="text-white">{trade.exit_price.toFixed(5)}</span>
                              </span>
                            )}
                          </div>
                          <span className="text-[#6B7280]">
                            Payout: <span className="text-[#f97316]">{trade.payout_percentage}%</span>
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
