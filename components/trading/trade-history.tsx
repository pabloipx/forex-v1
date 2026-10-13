"use client"

import { History, TrendingUp, TrendingDown } from "lucide-react"
import type { Trade } from "@/lib/price-engine/types"

interface TradeHistoryProps {
  trades: Trade[]
}

export function TradeHistory({ trades }: TradeHistoryProps) {
  const completedTrades = trades.filter((t) => t.result !== "pending")

  const stats = {
    total: completedTrades.length,
    wins: completedTrades.filter((t) => t.result === "win").length,
    losses: completedTrades.filter((t) => t.result === "loss").length,
    totalProfit: completedTrades.reduce((sum, t) => sum + (t.profit || 0), 0),
  }

  const winRate = stats.total > 0 ? (stats.wins / stats.total) * 100 : 0

  return (
    <div className="bg-[#121826] border border-[#1f2933] rounded-xl p-4">
      <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
        <History className="w-4 h-4 text-[#f97316]" />
        Histórico de Operações
      </h3>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <div className="bg-[#0B0F14] rounded-lg p-2 text-center">
          <div className="text-[#6B7280] text-xs">Total</div>
          <div className="text-white font-bold">{stats.total}</div>
        </div>
        <div className="bg-[#0B0F14] rounded-lg p-2 text-center">
          <div className="text-[#6B7280] text-xs">Wins</div>
          <div className="text-[#fb923c] font-bold">{stats.wins}</div>
        </div>
        <div className="bg-[#0B0F14] rounded-lg p-2 text-center">
          <div className="text-[#6B7280] text-xs">Losses</div>
          <div className="text-[#EF4444] font-bold">{stats.losses}</div>
        </div>
        <div className="bg-[#0B0F14] rounded-lg p-2 text-center">
          <div className="text-[#6B7280] text-xs">Win Rate</div>
          <div className={`font-bold ${winRate >= 50 ? "text-[#fb923c]" : "text-[#EF4444]"}`}>
            {winRate.toFixed(0)}%
          </div>
        </div>
      </div>

      {/* P&L */}
      <div
        className={`p-3 rounded-lg mb-4 flex items-center justify-between ${stats.totalProfit >= 0 ? "bg-[#fb923c]/10" : "bg-[#EF4444]/10"}`}
      >
        <span className="text-[#9CA3AF] text-sm">Lucro/Prejuízo Total</span>
        <span className={`font-mono font-bold ${stats.totalProfit >= 0 ? "text-[#fb923c]" : "text-[#EF4444]"}`}>
          {stats.totalProfit >= 0 ? "+" : ""}${stats.totalProfit.toFixed(2)}
        </span>
      </div>

      {/* Trade List */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {completedTrades.length === 0 ? (
          <div className="text-[#6B7280] text-sm text-center py-6">Nenhuma operação concluída</div>
        ) : (
          completedTrades.slice(0, 20).map((trade) => (
            <div
              key={trade.id}
              className={`p-3 rounded-lg border ${
                trade.result === "win"
                  ? "bg-[#fb923c]/5 border-[#fb923c]/20"
                  : trade.result === "loss"
                    ? "bg-[#EF4444]/5 border-[#EF4444]/20"
                    : "bg-[#1f2933] border-[#1f2933]"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {trade.direction === "call" ? (
                    <TrendingUp className="w-4 h-4 text-[#fb923c]" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-[#EF4444]" />
                  )}
                  <div>
                    <div className="text-white text-sm font-medium">{trade.symbol.split("-")[0]}</div>
                    <div className="text-[#6B7280] text-xs">
                      {new Date(trade.entryTime).toLocaleTimeString("pt-BR")}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={`text-sm font-bold ${
                      trade.result === "win"
                        ? "text-[#fb923c]"
                        : trade.result === "loss"
                          ? "text-[#EF4444]"
                          : "text-[#9CA3AF]"
                    }`}
                  >
                    {trade.result === "win" ? "WIN" : trade.result === "loss" ? "LOSS" : "TIE"}
                  </div>
                  <div
                    className={`text-xs font-mono ${(trade.profit || 0) >= 0 ? "text-[#fb923c]" : "text-[#EF4444]"}`}
                  >
                    {(trade.profit || 0) >= 0 ? "+" : ""}${(trade.profit || 0).toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
