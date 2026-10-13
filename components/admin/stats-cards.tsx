"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface StatsCardsProps {
  stats: {
    totalUsers: number
    totalTrades: number
    activeTrades: number
    totalVolume: number
    wins: number
    losses: number
    winRate: number
    totalProfit: number
    totalBalance: number
  }
}

export function StatsCards({ stats }: StatsCardsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-zinc-400">Total Users</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-white">{stats.totalUsers}</div>
        </CardContent>
      </Card>

      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-zinc-400">Total Trades</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-white">{stats.totalTrades}</div>
          <p className="text-xs text-zinc-500 mt-1">{stats.activeTrades} active</p>
        </CardContent>
      </Card>

      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-zinc-400">Trading Volume</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-white">${stats.totalVolume.toFixed(2)}</div>
        </CardContent>
      </Card>

      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-zinc-400">Win Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-white">{stats.winRate.toFixed(1)}%</div>
          <p className="text-xs text-zinc-500 mt-1">
            {stats.wins}W / {stats.losses}L
          </p>
        </CardContent>
      </Card>

      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-zinc-400">Total P&L</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${stats.totalProfit >= 0 ? "text-emerald-500" : "text-red-500"}`}>
            ${stats.totalProfit.toFixed(2)}
          </div>
        </CardContent>
      </Card>

      <Card className="border-zinc-800 bg-zinc-900">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-zinc-400">System Balance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-white">${stats.totalBalance.toFixed(2)}</div>
        </CardContent>
      </Card>
    </div>
  )
}
