"use client"

import {
  ArrowDownCircle,
  ArrowUpCircle,
  Users,
  Wallet,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  BarChart3,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { AdminCharts } from "./admin-charts"

interface AdminHomeProps {
  stats: {
    totalDeposits: number
    totalWithdrawals: number
    totalUsers: number
    totalBalances: number
    totalTrades: number
    platformProfit: number
    pendingWithdrawals: number
    pendingDeposits: number
  }
  loading: boolean
  onRefresh: () => void
  refreshKey: number
}

export function AdminHome({ stats, loading, onRefresh, refreshKey }: AdminHomeProps) {
  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)

  const cards = [
    {
      title: "Usuários",
      value: stats.totalUsers,
      isCount: true,
      icon: Users,
      accent: "#22d3ee",
      caption: "Total cadastrados",
    },
    {
      title: "Depósitos",
      value: stats.totalDeposits,
      icon: ArrowDownCircle,
      accent: "#22c55e",
      caption: stats.pendingDeposits > 0 ? `${stats.pendingDeposits} pendentes` : "Confirmados",
      captionWarn: stats.pendingDeposits > 0,
    },
    {
      title: "Saques",
      value: stats.totalWithdrawals,
      icon: ArrowUpCircle,
      accent: "#ef4444",
      caption: stats.pendingWithdrawals > 0 ? `${stats.pendingWithdrawals} pendentes` : "Processados",
      captionWarn: stats.pendingWithdrawals > 0,
    },
    {
      title: "Saldo Total",
      value: stats.totalBalances,
      icon: Wallet,
      accent: "#fdba74",
      caption: "Saldo dos usuários",
    },
    {
      title: "Total Trades",
      value: stats.totalTrades,
      isCount: true,
      icon: BarChart3,
      accent: "#fdba74",
      caption: "Operações reais",
    },
    {
      title: "Lucro Plataforma",
      value: stats.platformProfit,
      icon: stats.platformProfit >= 0 ? TrendingUp : TrendingDown,
      accent: stats.platformProfit >= 0 ? "#22c55e" : "#ef4444",
      caption: stats.platformProfit >= 0 ? "Resultado positivo" : "Resultado negativo",
      captionWarn: stats.platformProfit < 0,
    },
  ]

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22c55e] opacity-60" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#22c55e]" />
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-white">Dashboard</h1>
          </div>
          <p className="mt-1 text-sm text-gray-400">Visão geral da operação em tempo real.</p>
        </div>
        <Button
          onClick={onRefresh}
          disabled={loading}
          variant="outline"
          className="border-[#1b2333] bg-[#0e1521] text-gray-300 hover:bg-[#141c2b] hover:text-white"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card, index) => (
          <div
            key={index}
            className="group relative overflow-hidden rounded-2xl border border-[#1b2333] bg-gradient-to-b from-[#0e1521] to-[#0a0f18] p-5 transition-all hover:border-[#2A3142]"
          >
            {/* glow accent */}
            <div
              className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full opacity-20 blur-2xl transition-opacity group-hover:opacity-40"
              style={{ background: card.accent }}
            />
            {/* top accent line */}
            <div
              className="absolute left-0 top-0 h-full w-[3px] opacity-70"
              style={{ background: `linear-gradient(to bottom, ${card.accent}, transparent)` }}
            />
            <div className="relative">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-400">{card.title}</span>
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-xl border"
                  style={{
                    borderColor: `${card.accent}33`,
                    background: `${card.accent}1a`,
                  }}
                >
                  <card.icon className="h-5 w-5" style={{ color: card.accent }} />
                </div>
              </div>
              <div className="mb-1.5 text-2xl font-bold tracking-tight text-white tabular-nums">
                {card.isCount ? card.value.toLocaleString("pt-BR") : formatCurrency(card.value)}
              </div>
              <span className={`text-xs ${card.captionWarn ? "text-yellow-500" : "text-gray-500"}`}>
                {card.caption}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <AdminCharts refreshKey={refreshKey} />
    </div>
  )
}
