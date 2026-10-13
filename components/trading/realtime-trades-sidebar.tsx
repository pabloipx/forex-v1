"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { TrendingUp, TrendingDown, Clock, AlertCircle } from "lucide-react"
import type { RealtimeChannel } from "@supabase/supabase-js"

interface Trade {
  id: string
  symbol: string
  direction: string
  amount: number
  result: string
  profit: number | null
  entry_price: number
  exit_price: number | null
  created_at: string
  expiry_time: string
  timeframe: number
}

interface RealtimeTradesSidebarProps {
  userId?: string
}

export function RealtimeTradesSidebar({ userId }: RealtimeTradesSidebarProps) {
  const [trades, setTrades] = useState<Trade[]>([])
  const [timeRemaining, setTimeRemaining] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!userId) return

    const supabase = createClient()
    let channel: RealtimeChannel

    const fetchTrades = async () => {
      const { data } = await supabase
        .from("trades")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10)

      if (data) {
        setTrades(data)
      }
      setLoading(false)
    }

    fetchTrades()

    channel = supabase
      .channel(`trades:user_id=eq.${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "trades",
          filter: `user_id=eq.${userId}`,
        },
        (payload: any) => {
          setTrades((prev) => [payload.new as Trade, ...prev].slice(0, 10))
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "trades",
          filter: `user_id=eq.${userId}`,
        },
        (payload: any) => {
          setTrades((prev) => prev.map((t) => (t.id === payload.new.id ? (payload.new as Trade) : t)))
        },
      )
      .subscribe()

    return () => {
      channel.unsubscribe()
    }
  }, [userId])

  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      const newTimeRemaining: Record<string, number> = {}

      trades.forEach((trade) => {
        if (trade.result === "pending") {
          const expiryTime = new Date(trade.expiry_time).getTime()
          const remaining = Math.max(0, expiryTime - now)
          newTimeRemaining[trade.id] = remaining
        }
      })

      setTimeRemaining(newTimeRemaining)
    }, 100)

    return () => clearInterval(interval)
  }, [trades])

  const formatBRL = (value: number) => {
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
  }

  const formatTime = (ms: number) => {
    if (ms <= 0) return "Finalizando..."

    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60

    if (minutes > 0) {
      return `${minutes}m ${seconds}s`
    }
    return `${seconds}s`
  }

  const getAssetName = (symbol: string) => {
    const names: Record<string, string> = {
      EURUSD_OTC: "EUR/USD",
      GBPUSD_OTC: "GBP/USD",
      USDJPY_OTC: "USD/JPY",
      AUDUSD_OTC: "AUD/USD",
      BTCUSD_OTC: "BTC/USD",
    }
    return names[symbol] || symbol
  }

  if (loading) {
    return (
      <div className="px-4 pb-4">
        <div className="text-white/70 text-sm font-semibold mb-3">Operações Recentes</div>
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#f97316] border-t-transparent" />
        </div>
      </div>
    )
  }

  if (trades.length === 0) {
    return (
      <div className="px-4 pb-4">
        <div className="text-white/70 text-sm font-semibold mb-3">Operações Recentes</div>
        <div className="bg-[#1F2933] rounded-lg p-6 border border-white/5 text-center">
          <AlertCircle className="w-8 h-8 text-white/20 mx-auto mb-2" />
          <div className="text-white/40 text-xs">Nenhuma operação ainda</div>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 pb-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-white/70 text-sm font-semibold">Operações Recentes</div>
        <a href="/transactions" className="text-[#f97316] text-xs hover:underline">
          Ver tudo
        </a>
      </div>
      <div className="space-y-2 max-h-[400px] overflow-y-auto">
        {trades.map((trade) => {
          const isPending = trade.result === "pending"
          const isWin = trade.result === "win"
          const isLoss = trade.result === "loss"
          const isCall = trade.direction?.toUpperCase() === "CALL"
          const remaining = timeRemaining[trade.id] || 0
          const progress =
            isPending && trade.timeframe ? ((trade.timeframe * 1000 - remaining) / (trade.timeframe * 1000)) * 100 : 0

          return (
            <div
              key={trade.id}
              className={`rounded-lg p-3 border transition-all ${
                isPending
                  ? "bg-yellow-500/5 border-yellow-500/30 shadow-lg shadow-yellow-500/10"
                  : isWin
                    ? "bg-[#1F2933] border-[#f97316]/20"
                    : "bg-[#1F2933] border-white/5"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      isPending ? "bg-yellow-500/20" : isCall ? "bg-[#f97316]/20" : "bg-[#EF4444]/20"
                    }`}
                  >
                    {isCall ? (
                      <TrendingUp className={`w-4 h-4 ${isPending ? "text-yellow-500" : "text-[#f97316]"}`} />
                    ) : (
                      <TrendingDown className={`w-4 h-4 ${isPending ? "text-yellow-500" : "text-[#EF4444]"}`} />
                    )}
                  </div>
                  <div>
                    <div className="text-white text-xs font-semibold">{getAssetName(trade.symbol)}</div>
                    <div className={`text-[10px] font-medium ${isPending ? "text-yellow-500" : "text-white/40"}`}>
                      {isCall ? "COMPRA" : "VENDA"}
                      {isPending && (
                        <span className="ml-1 px-1.5 py-0.5 bg-yellow-500/20 rounded text-yellow-500">ABERTA</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-white text-xs font-semibold">{formatBRL(trade.amount)}</div>
                  {isPending ? (
                    <div className="flex items-center gap-1 text-yellow-500 text-[10px] font-bold">
                      <Clock className="w-3 h-3 animate-pulse" />
                      {formatTime(remaining)}
                    </div>
                  ) : (
                    <div className={`text-xs font-bold ${isWin ? "text-[#f97316]" : "text-[#EF4444]"}`}>
                      {isWin ? "+" : ""}
                      {formatBRL(trade.profit || 0)}
                    </div>
                  )}
                </div>
              </div>

              {isPending && (
                <div className="mt-2">
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-yellow-500 rounded-full transition-all duration-100"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              {!isPending && (
                <div className="mt-2 pt-2 border-t border-white/5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-white/40">Resultado</span>
                    <span className={`font-bold uppercase ${isWin ? "text-[#f97316]" : "text-[#EF4444]"}`}>
                      {isWin ? "✓ GANHOU" : "✗ PERDEU"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
