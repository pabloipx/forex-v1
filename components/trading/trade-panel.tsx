"use client"

import { useState } from "react"
import { ArrowUp, ArrowDown, Clock, DollarSign } from "lucide-react"
import type { OTCAsset, Trade } from "@/lib/price-engine/types"

interface TradePanelProps {
  asset: OTCAsset
  currentPrice: number
  balance: { real: number; demo: number }
  isDemo: boolean
  onTrade: (direction: "call" | "put", amount: number, duration: number) => { success: boolean; error?: string }
  activeTrades: Trade[]
}

const DURATIONS = [
  { label: "30s", value: 30 },
  { label: "1m", value: 60 },
  { label: "2m", value: 120 },
  { label: "5m", value: 300 },
]

const QUICK_AMOUNTS = [10, 25, 50, 100, 250, 500]

export function TradePanel({ asset, currentPrice, balance, isDemo, onTrade, activeTrades }: TradePanelProps) {
  const [amount, setAmount] = useState(10)
  const [duration, setDuration] = useState(60)
  const [error, setError] = useState<string | null>(null)

  const currentBalance = isDemo ? balance.demo : balance.real
  const potentialProfit = amount * (asset.payout / 100)

  const handleTrade = (direction: "call" | "put") => {
    setError(null)
    const result = onTrade(direction, amount, duration)
    if (!result.success) {
      setError(result.error || "Erro ao abrir operação")
    }
  }

  const formatPrice = (price: number) => {
    if (asset.symbol.includes("BTC")) return price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })
    if (asset.symbol.includes("JPY")) return price.toFixed(3)
    return price.toFixed(5)
  }

  return (
    <div className="bg-[#121826] border border-[#1f2933] rounded-xl p-4 flex flex-col gap-4">
      {/* Price Display */}
      <div className="text-center">
        <div className="text-[#9CA3AF] text-xs mb-1">Preço Atual</div>
        <div className="text-2xl font-mono font-bold text-[#f97316]">{formatPrice(currentPrice)}</div>
        <div className="text-[#fb923c] text-sm font-medium">Payout: {asset.payout}%</div>
      </div>

      {/* Amount */}
      <div>
        <label className="text-[#9CA3AF] text-xs mb-2 block">Valor da Operação</label>
        <div className="relative">
          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(Math.max(1, Number(e.target.value)))}
            className="w-full pl-9 pr-4 py-3 bg-[#0B0F14] border border-[#1f2933] rounded-lg text-white font-mono text-lg focus:outline-none focus:border-[#f97316]"
          />
        </div>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {QUICK_AMOUNTS.map((amt) => (
            <button
              key={amt}
              onClick={() => setAmount(amt)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                amount === amt
                  ? "bg-[#f97316] text-white"
                  : "bg-[#1f2933] text-[#9CA3AF] hover:bg-[#f97316]/20 hover:text-white"
              }`}
            >
              ${amt}
            </button>
          ))}
        </div>
      </div>

      {/* Duration */}
      <div>
        <label className="text-[#9CA3AF] text-xs mb-2 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Duração
        </label>
        <div className="grid grid-cols-4 gap-2">
          {DURATIONS.map((d) => (
            <button
              key={d.value}
              onClick={() => setDuration(d.value)}
              className={`py-2.5 rounded-lg text-sm font-medium transition-colors ${
                duration === d.value
                  ? "bg-[#f97316] text-white"
                  : "bg-[#1f2933] text-[#9CA3AF] hover:bg-[#f97316]/20 hover:text-white"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* Potential Profit */}
      <div className="bg-[#0B0F14] rounded-lg p-3 flex justify-between items-center">
        <span className="text-[#9CA3AF] text-sm">Lucro Potencial</span>
        <span className="text-[#fb923c] font-mono font-bold">+${potentialProfit.toFixed(2)}</span>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-[#EF4444]/10 border border-[#EF4444]/30 rounded-lg p-3 text-[#EF4444] text-sm text-center">
          {error}
        </div>
      )}

      {/* Trade Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => handleTrade("call")}
          disabled={amount > currentBalance}
          className="flex items-center justify-center gap-2 py-4 bg-[#fb923c] hover:bg-[#f97316] disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white font-bold text-lg transition-colors"
        >
          <ArrowUp className="w-5 h-5" />
          CALL
        </button>
        <button
          onClick={() => handleTrade("put")}
          disabled={amount > currentBalance}
          className="flex items-center justify-center gap-2 py-4 bg-[#EF4444] hover:bg-[#DC2626] disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white font-bold text-lg transition-colors"
        >
          <ArrowDown className="w-5 h-5" />
          PUT
        </button>
      </div>

      {/* Balance */}
      <div className="text-center pt-2 border-t border-[#1f2933]">
        <span className="text-[#6B7280] text-xs">Saldo Disponível: </span>
        <span className="text-white font-mono font-medium">${currentBalance.toFixed(2)}</span>
      </div>
    </div>
  )
}
