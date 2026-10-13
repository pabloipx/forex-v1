"use client"

import { useEffect, useState } from "react"

interface ActiveTradeDisplayProps {
  direction: "CALL" | "PUT"
  amount: number
  entryPrice: number
  currentPrice: number
  expiryTime: number
  payout: number
  symbol?: string
}

export function ActiveTradeDisplay({
  direction,
  amount,
  entryPrice,
  currentPrice,
  expiryTime,
  payout,
  symbol = "EURUSD_OTC",
}: ActiveTradeDisplayProps) {
  const [remainingTime, setRemainingTime] = useState(0)

  useEffect(() => {
    const updateTimer = () => {
      const now = Math.floor(Date.now() / 1000)
      const remaining = Math.max(0, expiryTime - now)
      setRemainingTime(remaining)
    }

    updateTimer()
    const interval = setInterval(updateTimer, 250)

    return () => clearInterval(interval)
  }, [expiryTime])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const formatPrice = (price: number) => {
    if (symbol.includes("BTC")) return price.toFixed(2)
    if (symbol.includes("JPY")) return price.toFixed(3)
    return price.toFixed(5)
  }

  const priceDiff = currentPrice - entryPrice
  const isWinning = (direction === "CALL" && priceDiff > 0) || (direction === "PUT" && priceDiff < 0)
  const potentialProfit = (amount * payout) / 100

  const directionColor = direction === "CALL" ? "bg-[#26a69a]" : "bg-[#ef5350]"
  const statusColor = isWinning ? "text-[#26a69a]" : "text-[#ef5350]"

  return (
    <div className="rounded-xl p-3 space-y-2" style={{ backgroundColor: "#131318" }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded text-white text-xs font-bold ${directionColor}`}>{direction}</span>
          <span className="text-white font-mono text-sm">${amount.toFixed(2)}</span>
        </div>
        <div className="text-right">
          <div className="text-white font-mono text-xl font-bold">{formatTime(remainingTime)}</div>
        </div>
      </div>

      <div className="flex justify-between text-xs">
        <div>
          <span className="text-white/50">Entrada: </span>
          <span className="text-white font-mono">{formatPrice(entryPrice)}</span>
        </div>
        <div>
          <span className="text-white/50">Atual: </span>
          <span className={`font-mono font-medium ${statusColor}`}>{formatPrice(currentPrice)}</span>
        </div>
      </div>

      <div className="flex justify-between items-center">
        <span className={`text-sm font-medium ${statusColor}`}>{isWinning ? "GANHANDO" : "PERDENDO"}</span>
        <span className="text-[#26a69a] font-medium">+${potentialProfit.toFixed(2)}</span>
      </div>

      {/* Barra de progresso */}
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-100 ${isWinning ? "bg-[#26a69a]" : "bg-[#ef5350]"}`}
          style={{
            width: `${Math.max(0, Math.min(100, (remainingTime / 60) * 100))}%`,
          }}
        />
      </div>
    </div>
  )
}
