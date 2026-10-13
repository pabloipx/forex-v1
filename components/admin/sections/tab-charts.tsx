"use client"

import { useEffect, useState } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

const ADMIN_PASSWORD = ""

interface AnalyticsData {
  cashFlow: { date: string; depositos: number; depositosTotal: number; saques: number }[]
  activitySeries: { date: string; trades: number; usuarios: number }[]
}

const fmtCurrency = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v)

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

function useAnalytics(refreshKey: number) {
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

  return { data, loading }
}

function ChartShell({
  title,
  subtitle,
  accent,
  children,
}: {
  title: string
  subtitle: string
  accent: string
  children: React.ReactNode
}) {
  return (
    <div className="relative mb-6 overflow-hidden rounded-2xl border border-[#1b2333] bg-gradient-to-b from-[#0e1521] to-[#0a0f18] p-5">
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full blur-3xl"
        style={{ background: `${accent}1a` }}
      />
      <div className="relative">
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          <p className="text-xs text-gray-500">{subtitle}</p>
        </div>
        {children}
      </div>
    </div>
  )
}

function Skeleton() {
  return <div className="mb-6 h-64 animate-pulse rounded-2xl border border-[#1b2333] bg-[#0d1117]" />
}

export function UsersChart({ refreshKey }: { refreshKey: number }) {
  const { data, loading } = useAnalytics(refreshKey)
  if (loading || !data) return <Skeleton />

  const total = data.activitySeries.reduce((s, d) => s + d.usuarios, 0)

  return (
    <ChartShell
      title="Novos Usuários"
      subtitle={`${total} cadastros · últimos 14 dias`}
      accent="#22d3ee"
    >
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data.activitySeries} margin={{ left: -10, right: 8, top: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1b2333" vertical={false} />
          <XAxis dataKey="date" stroke="#4b5563" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis stroke="#4b5563" fontSize={11} tickLine={false} axisLine={false} width={36} allowDecimals={false} />
          <Tooltip content={<TooltipBox />} cursor={{ fill: "#ffffff08" }} />
          <Bar dataKey="usuarios" name="Novos usuários" radius={[4, 4, 0, 0]}>
            {data.activitySeries.map((_, i) => (
              <Cell key={i} fill="#22d3ee" />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  )
}

export function DepositsChart({ refreshKey }: { refreshKey: number }) {
  const { data, loading } = useAnalytics(refreshKey)
  if (loading || !data) return <Skeleton />

  const total = data.cashFlow.reduce((s, d) => s + d.depositosTotal, 0)

  return (
    <ChartShell
      title="Depósitos"
      subtitle={`${fmtCurrency(total)} movimentados · últimos 14 dias`}
      accent="#22c55e"
    >
      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data.cashFlow} margin={{ left: -10, right: 8, top: 4 }}>
          <defs>
            <linearGradient id="gDepTab" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#1b2333" vertical={false} />
          <XAxis dataKey="date" stroke="#4b5563" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis stroke="#4b5563" fontSize={11} tickLine={false} axisLine={false} width={48} />
          <Tooltip content={<TooltipBox currency />} />
          <Area
            type="monotone"
            dataKey="depositosTotal"
            name="Depósitos"
            stroke="#22c55e"
            strokeWidth={2.5}
            fill="url(#gDepTab)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </ChartShell>
  )
}
