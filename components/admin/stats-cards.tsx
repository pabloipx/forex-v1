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
      <Card className="border-adm-line bg-adm-surface">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-adm-muted">Total Users</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-adm-fg">{stats.totalUsers}</div>
        </CardContent>
      </Card>

      <Card className="border-adm-line bg-adm-surface">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-adm-muted">Total Trades</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-adm-fg">{stats.totalTrades}</div>
          <p className="text-xs text-adm-muted mt-1">{stats.activeTrades} active</p>
        </CardContent>
      </Card>

      <Card className="border-adm-line bg-adm-surface">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-adm-muted">Trading Volume</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-adm-fg">${stats.totalVolume.toFixed(2)}</div>
        </CardContent>
      </Card>

      <Card className="border-adm-line bg-adm-surface">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-adm-muted">Win Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-adm-fg">{stats.winRate.toFixed(1)}%</div>
          <p className="text-xs text-adm-muted mt-1">
            {stats.wins}W / {stats.losses}L
          </p>
        </CardContent>
      </Card>

      <Card className="border-adm-line bg-adm-surface">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-adm-muted">Total P&L</CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${stats.totalProfit >= 0 ? "text-adm-accent" : "text-red-500"}`}>
            ${stats.totalProfit.toFixed(2)}
          </div>
        </CardContent>
      </Card>

      <Card className="border-adm-line bg-adm-surface">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-adm-muted">System Balance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-adm-fg">${stats.totalBalance.toFixed(2)}</div>
        </CardContent>
      </Card>
    </div>
  )
}
