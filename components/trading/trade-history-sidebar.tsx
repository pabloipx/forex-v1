"use client"
import { memo, useEffect, useState, useCallback, useRef } from "react"
import { Clock, Loader2, TrendingUp, TrendingDown, RefreshCw } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

interface Trade {
  id: string
  symbol: string
  direction: string
  amount: number
  entry_price: number
  exit_price: number | null
  result: string
  profit: number
  created_at: string
  timeframe: number
  entry_time: string
  expiry_time: string
  is_demo: boolean
}

interface TradeHistorySidebarProps {
  userId: string
  refreshTrigger?: number
  isDemo: boolean
}

function sortTrades(trades: Trade[]): Trade[] {
  const copy = [...trades]
  return copy.sort((a, b) => {
    const aIsPending = a.result === "pending"
    const bIsPending = b.result === "pending"

    if (aIsPending && !bIsPending) return -1
    if (!aIsPending && bIsPending) return 1

    const dateA = new Date(a.created_at).getTime()
    const dateB = new Date(b.created_at).getTime()
    return dateB - dateA
  })
}

function TradeHistorySidebarBase({ userId, refreshTrigger, isDemo }: TradeHistorySidebarProps) {
  const [trades, setTrades] = useState<Trade[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState(Date.now())
  const [isRefreshing, setIsRefreshing] = useState(false)

  const mountedRef = useRef(true)
  const fetchingRef = useRef(false)

  const fetchTrades = useCallback(
    async (showRefresh = false) => {
      if (!userId || !mountedRef.current || fetchingRef.current) return

      fetchingRef.current = true
      if (showRefresh) setIsRefreshing(true)

      try {
        if (!showRefresh) setIsLoading(true)
        const supabase = createClient()

        const { data, error } = await supabase
          .from("trades")
          .select("*")
          .eq("user_id", userId)
          .eq("is_demo", isDemo)
          .order("created_at", { ascending: false })
          .limit(20)

        if (!error && data && mountedRef.current) {
          const sorted = sortTrades(data)
          setTrades(sorted)
        }
      } catch (err) {
        console.error("Erro ao buscar trades:", err)
      } finally {
        if (mountedRef.current) {
          setIsLoading(false)
          setIsRefreshing(false)
        }
        fetchingRef.current = false
      }
    },
    [userId, isDemo],
  )

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  // Ao trocar de conta (demo/real), esvazia a lista para não misturar históricos.
  useEffect(() => {
    setTrades([])
    setIsLoading(true)
  }, [isDemo])

  useEffect(() => {
    if (!userId) return

    fetchTrades()

    const supabase = createClient()

    const channel = supabase
      .channel(`trades-${userId}-${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "trades",
          filter: `user_id=eq.${userId}`,
        },
        (payload: any) => {
          if (!mountedRef.current) return

          if (payload.eventType === "INSERT") {
            const newTrade = payload.new as Trade
            // Ignora trades do outro tipo de conta (demo vs real).
            if (newTrade.is_demo !== isDemo) return
            setTrades((prev) => {
              const updated = [newTrade, ...prev.filter((t) => t.id !== newTrade.id)]
              return sortTrades(updated)
            })
          } else if (payload.eventType === "UPDATE") {
            const updatedTrade = payload.new as Trade
            if (updatedTrade.is_demo !== isDemo) return
            setTrades((prev) => {
              const updated = prev.map((t) => (t.id === updatedTrade.id ? updatedTrade : t))
              return sortTrades(updated)
            })
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, fetchTrades])

  useEffect(() => {
    if (refreshTrigger && refreshTrigger > 0) {
      setTimeout(fetchTrades, 100)
    }
  }, [refreshTrigger, fetchTrades])

  useEffect(() => {
    const interval = setInterval(() => {
      if (mountedRef.current) {
        setCurrentTime(Date.now())
      }
    }, 100) // Atualizar a cada 100ms para countdown mais preciso
    return () => clearInterval(interval)
  }, [])

  const getAssetName = (symbol: string) => {
    const names: Record<string, string> = {
      EURUSD_OTC: "EUR/USD",
      GBPUSD_OTC: "GBP/USD",
      USDJPY_OTC: "USD/JPY",
      AUDUSD_OTC: "AUD/USD",
      BTCUSD_OTC: "BTC/USD",
    }
    return names[symbol] || symbol.replace("_OTC", "").replace("_", "/")
  }

  const formatTime = (seconds: number) => {
    if (seconds <= 0) return "0:00"
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${String(secs).padStart(2, "0")}`
  }

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const formatBRL = (value: number) => {
    const safeValue = typeof value === "number" && !isNaN(value) ? value : 0
    return safeValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
  }

  const getRemainingTime = (trade: Trade): number => {
    // Se já tem resultado definido (win/loss), não está pendente
    if (trade.result === "win" || trade.result === "loss") return -1

    // Calcular expiry a partir de expiry_time OU entry_time + timeframe OU created_at + timeframe
    let expiryMs: number | null = null
    const timeframeSec = trade.timeframe || 60 // default 60 segundos
    
    if (trade.expiry_time) {
      expiryMs = new Date(trade.expiry_time).getTime()
    } else if (trade.entry_time) {
      expiryMs = new Date(trade.entry_time).getTime() + timeframeSec * 1000
    } else if (trade.created_at) {
      expiryMs = new Date(trade.created_at).getTime() + timeframeSec * 1000
    }

    if (!expiryMs || isNaN(expiryMs)) return -1
    
    const remaining = (expiryMs - currentTime) / 1000
    return remaining
  }

  useEffect(() => {
    if (!userId) return

    // Polling a cada 3 segundos para pegar trades finalizados
    const pollInterval = setInterval(() => {
      if (mountedRef.current && !fetchingRef.current) {
        fetchTrades(false)
      }
    }, 3000)

    return () => clearInterval(pollInterval)
  }, [userId, fetchTrades])

  if (isLoading && trades.length === 0) {
    return (
      <div className="p-4 border-t border-white/10 h-full flex flex-col" style={{ backgroundColor: "#121826" }}>
        <div className="flex items-center gap-2 mb-3">
          <Clock className="w-5 h-5 text-white/60" />
          <h3 className="text-white font-bold">Histórico</h3>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 text-white/40 animate-spin" />
        </div>
      </div>
    )
  }

  if (trades.length === 0) {
    return (
      <div className="p-4 border-t border-white/10 h-full flex flex-col" style={{ backgroundColor: "#121826" }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-white/60" />
            <h3 className="text-white font-bold">Histórico</h3>
          </div>
          <button
            onClick={() => fetchTrades(true)}
            disabled={isRefreshing}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 text-white/60 ${isRefreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
        <p className="text-white/40 text-sm text-center py-6">Nenhuma operação ainda</p>
      </div>
    )
  }

  return (
    <div className="border-t border-white/10 h-full flex flex-col" style={{ backgroundColor: "#121826" }}>
      <div className="p-2 lg:p-3 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 lg:gap-2">
            <Clock className="w-3 h-3 lg:w-4 lg:h-4 text-white/60" />
            <h3 className="text-white font-semibold text-[10px] lg:text-sm">Histórico</h3>
            <span className="text-white/40 text-[9px] lg:text-xs">({trades.length})</span>
          </div>
          <button
            onClick={() => fetchTrades(true)}
            disabled={isRefreshing}
            className="p-1 lg:p-1.5 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
            title="Atualizar"
          >
            <RefreshCw className={`w-3 h-3 lg:w-4 lg:h-4 text-white/60 ${isRefreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {trades.map((trade) => {
          const remaining = getRemainingTime(trade)
          const isWin = trade.result === "win"
          const isLoss = trade.result === "loss"
          // Trade está pendente se não é win nem loss
          const isPending = !isWin && !isLoss
          const isCall = trade.direction?.toUpperCase() === "CALL"

          let bgColor = "bg-transparent"
          if (isPending) {
            bgColor = "bg-orange-500/10 border-l-2 border-l-orange-500"
          } else if (isWin) {
            bgColor = "bg-green-500/10 border-l-2 border-l-green-500"
          } else if (isLoss) {
            bgColor = "bg-red-500/10 border-l-2 border-l-red-500"
          }

          return (
            <div key={trade.id} className={`p-2 lg:p-3 border-b border-white/5 ${bgColor}`}>
              {/* Mobile: Layout compacto vertical */}
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-1 lg:gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 lg:gap-2">
                    {isCall ? (
                      <TrendingUp className="w-3 h-3 lg:w-4 lg:h-4 text-[#f97316]" />
                    ) : (
                      <TrendingDown className="w-3 h-3 lg:w-4 lg:h-4 text-[#EF4444]" />
                    )}
                    <span className="text-white font-medium text-[10px] lg:text-sm truncate">{getAssetName(trade.symbol)}</span>
                    <span
                      className={`text-[8px] lg:text-[10px] font-bold px-1 lg:px-1.5 py-0.5 rounded ${
                        isCall ? "bg-[#f97316]/20 text-[#f97316]" : "bg-[#EF4444]/20 text-[#EF4444]"
                      }`}
                    >
                      {isCall ? "C" : "V"}
                    </span>
                  </div>
                  <div className="text-white/40 text-[8px] lg:text-[10px] mt-0.5 hidden lg:block">{formatDateTime(trade.entry_time)}</div>
                </div>

                <div className="text-left lg:text-right flex-shrink-0">
                  <div className="text-white/60 text-[9px] lg:text-xs">{formatBRL(trade.amount)}</div>

                  {isPending ? (
                    <div className="flex flex-col items-start lg:items-end gap-0.5 mt-0.5">
                      <div className="flex items-center gap-1.5 lg:justify-end">
                        <Clock className="w-3.5 h-3.5 lg:w-4 lg:h-4 text-orange-400 animate-pulse" />
                        <span className="text-orange-400 text-xs lg:text-sm font-mono font-bold">
                          {remaining > 0 ? (
                            remaining >= 60
                              ? `${Math.floor(remaining / 60)}m${Math.floor(remaining % 60)}s`
                              : `${Math.max(0, Math.floor(remaining))}s`
                          ) : (
                            "0s"
                          )}
                        </span>
                      </div>
                      <div className="w-20 lg:w-24 h-1.5 lg:h-2 rounded-full bg-orange-500/20 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-orange-500 transition-all duration-500"
                          style={{ width: `${Math.max(0, Math.min(100, (remaining / (trade.timeframe || 60)) * 100))}%` }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div className={`text-[10px] lg:text-sm font-bold ${isWin ? "text-[#f97316]" : "text-[#EF4444]"}`}>
                      {isWin ? "+" : ""}
                      {formatBRL(trade.profit)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Memoizado: a tela de trade re-renderiza ~10x/s (tick do preço ao vivo). Como as props aqui
// são todas primitivas (userId, refreshTrigger, isDemo), o memo evita re-renderizar esta lista
// (que busca do banco e tem seu próprio timer) a cada tick — só re-renderiza quando algo real muda.
export const TradeHistorySidebar = memo(TradeHistorySidebarBase)
