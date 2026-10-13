"use client"

import { useEffect, useState } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

const ADMIN_PASSWORD = ""

interface AnalyticsData {
  profitSeries: { date: string; lucro: number }[]
  activitySeries: { date: string; trades: number; usuarios: number }[]
  topSymbols: { symbol: string; count: number }[]
  winLoss: { wins: number; losses: number }
}

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v)

function ChartCard({
  title,
  subtitle,
  children,
  className = "",
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-white/[0.06] bg-[#0c121c] p-5 transition-colors hover:border-white/[0.1] ${className}`}
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[#f97316]/[0.08] blur-3xl" />
      <div className="relative">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-[15px] font-semibold tracking-tight text-white">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
          </div>
        </div>
        {children}
      </div>
    </div>
  )
}

function TooltipBox({ active, payload, label, currency }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-lg border border-[#2A3142] bg-[#0b1019]/95 px-3 py-2 shadow-xl backdrop-blur">
      <p className="mb-1 text-[11px] font-medium text-gray-400">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="flex items-center gap-2 text-xs font-semibold" style={{ color: p.color }}>
          <span className="inline-block h-2 w-2 rounded-full" style={{ background: p.color }} />
          {p.name}: {currency ? fmtCurrency(p.value) : p.value.toLocaleString("pt-BR")}
        </p>
      ))}
    </div>
  )
}

const DONUT_COLORS = ["#22c55e", "#ef4444"]
const BAR_COLORS = ["#f97316", "#fb923c", "#fdba74", "#fdba74", "#fb923c"]

export function AdminCharts({ refreshKey }: { refreshKey: number }) {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    fetch("/api/admin/analytics", { headers: { "x-admin-token": ADMIN_PASSWORD } })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (active && d && !d.error) setData(d)
      })
      .catch(() => {})
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [refreshKey])

  if (loading || !data) {
    return (
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-64 animate-pulse rounded-2xl border border-[#1b2333] bg-[#0d1117] ${
              i === 0 ? "lg:col-span-2" : ""
            }`}
          />
        ))}
      </div>
    )
  }

  const totalWL = data.winLoss.wins + data.winLoss.losses
  const winRate = totalWL > 0 ? Math.round((data.winLoss.wins / totalWL) * 100) : 0
  const donutData = [
    { name: "Vitórias", value: data.winLoss.wins },
    { name: "Derrotas", value: data.winLoss.losses },
  ]

  return (
    <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* Win/Loss donut */}
      <ChartCard title="Vitórias x Derrotas" subtitle="Operações reais">
        <div className="relative">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={donutData}
                dataKey="value"
                nameKey="name"
                innerRadius={62}
                outerRadius={90}
                paddingAngle={3}
                stroke="none"
              >
                {donutData.map((_, i) => (
                  <Cell key={i} fill={DONUT_COLORS[i]} />
                ))}
              </Pie>
              <Tooltip content={<TooltipBox />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold text-white">{winRate}%</span>
            <span className="text-xs text-gray-500">taxa de vitória</span>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-center gap-6 text-xs">
          <span className="flex items-center gap-2 text-gray-400">
            <span className="h-2 w-2 rounded-full bg-[#22c55e]" /> {data.winLoss.wins} vitórias
          </span>
          <span className="flex items-center gap-2 text-gray-400">
            <span className="h-2 w-2 rounded-full bg-[#ef4444]" /> {data.winLoss.losses} derrotas
          </span>
        </div>
      </ChartCard>

      {/* Lucro plataforma - linha */}
      <ChartCard title="Lucro da Plataforma" subtitle="Resultado diário · 14 dias" className="lg:col-span-2">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data.profitSeries} margin={{ left: -10, right: 8, top: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1b2333" vertical={false} />
            <XAxis dataKey="date" stroke="#4b5563" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="#4b5563" fontSize={11} tickLine={false} axisLine={false} width={48} />
            <Tooltip content={<TooltipBox currency />} />
            <Line
              type="monotone"
              dataKey="lucro"
              name="Lucro"
              stroke="#f97316"
              strokeWidth={2.5}
              dot={{ r: 3, fill: "#f97316", strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Top símbolos - barras horizontais */}
      <ChartCard title="Ativos Mais Operados" subtitle="Top 5 · 14 dias">
        {data.topSymbols.length === 0 ? (
          <div className="flex h-[220px] items-center justify-center text-sm text-gray-600">Sem operações</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data.topSymbols} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1b2333" horizontal={false} />
              <XAxis type="number" stroke="#4b5563" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis
                type="category"
                dataKey="symbol"
                stroke="#9ca3af"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                width={84}
              />
              <Tooltip content={<TooltipBox />} cursor={{ fill: "#ffffff08" }} />
              <Bar dataKey="count" name="Operações" radius={[0, 6, 6, 0]}>
                {data.topSymbols.map((_, i) => (
                  <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      {/* Atividade - barras agrupadas */}
      <ChartCard title="Atividade da Plataforma" subtitle="Trades e novos usuários · 14 dias" className="lg:col-span-3">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={data.activitySeries} margin={{ left: -10, right: 8, top: 4 }} barGap={2}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1b2333" vertical={false} />
            <XAxis dataKey="date" stroke="#4b5563" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="#4b5563" fontSize={11} tickLine={false} axisLine={false} width={40} />
            <Tooltip content={<TooltipBox />} cursor={{ fill: "#ffffff08" }} />
            <Bar dataKey="trades" name="Trades" fill="#f97316" radius={[4, 4, 0, 0]} />
            <Bar dataKey="usuarios" name="Novos usuários" fill="#22d3ee" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  )
}
