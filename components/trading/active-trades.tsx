"use client"

import { useState, useEffect } from "react"
import { ArrowUp, ArrowDown, Clock } from "lucide-react"
import type { Trade } from "@/lib/price-engine/types"

interface ActiveTradesProps {
  trades: Trade[]
  currentPrices: Record<string, number>
}

export function ActiveTrades({ trades, currentPrices }: ActiveTradesProps) {
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(interval)
  }, [])

  if (trades.length === 0) {
    return (
      <div className="bg-[#121826] border border-[#1f2933] rounded-xl p-4">
        <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#f97316]" />
          Operações Ativas
        </h3>
        <div className="text-[#6B7280] text-sm text-center py-6">Nenhuma operação ativa</div>
      </div>
    )
  }

  return (
    <div className="bg-[#121826] border border-[#1f2933] rounded-xl p-4">
      <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
        <Clock className="w-4 h-4 text-[#f97316]" />
        Operações Ativas ({trades.length})
      </h3>
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {trades.map((trade) => {
          const timeLeft = Math.max(0, trade.expiryTime - now)
          const progress = 1 - timeLeft / (trade.timeframe * 1000)
          const currentPrice = currentPrices[trade.symbol] || trade.entryPrice
          const isWinning =
            (trade.direction === "call" && currentPrice > trade.entryPrice) ||
            (trade.direction === "put" && currentPrice < trade.entryPrice)

          const seconds = Math.ceil(timeLeft / 1000)

          return (
            <div
              key={trade.id}
              className={`p-3 rounded-lg border ${
                isWinning ? "bg-[#22C55E]/10 border-[#22C55E]/30" : "bg-[#EF4444]/10 border-[#EF4444]/30"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {trade.direction === "call" ? (
                    <ArrowUp className="w-4 h-4 text-[#22C55E]" />
                  ) : (
                    <ArrowDown className="w-4 h-4 text-[#EF4444]" />
                  )}
                  <span className="text-white text-sm font-medium">{trade.symbol.split("-")[0]}</span>
                </div>
                <span className={`font-mono text-sm font-bold ${isWinning ? "text-[#22C55E]" : "text-[#EF4444]"}`}>
                  {seconds}s
                </span>
              </div>
              <div className="flex justify-between text-xs text-[#9CA3AF] mb-2">
                <span>${trade.amount.toFixed(2)}</span>
                <span>
                  {trade.entryPrice.toFixed(5)} → {currentPrice.toFixed(5)}
                </span>
              </div>
              <div className="h-1.5 bg-[#1f2933] rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${isWinning ? "bg-[#22C55E]" : "bg-[#EF4444]"}`}
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
