"use client"

import { useMemo } from "react"
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { Users, TrendingUp } from "lucide-react"

interface InvitesChartProps {
  referrals: { created_at: string }[]
  rangeDays?: number
}

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]

export function InvitesChart({ referrals, rangeDays = 7 }: InvitesChartProps) {
  const { data, total, peak } = useMemo(() => {
    const days: { key: string; label: string; convites: number }[] = []
    const now = new Date()
    for (let i = rangeDays - 1; i >= 0; i--) {
      const d = new Date(now)
      d.setHours(0, 0, 0, 0)
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      days.push({ key, label: WEEKDAYS[d.getDay()], convites: 0 })
    }

    referrals.forEach((r) => {
      if (!r.created_at) return
      const key = new Date(r.created_at).toISOString().slice(0, 10)
      const bucket = days.find((day) => day.key === key)
      if (bucket) bucket.convites += 1
    })

    const total = days.reduce((sum, d) => sum + d.convites, 0)
    const peak = days.reduce((max, d) => Math.max(max, d.convites), 0)
    return { data: days, total, peak }
  }, [referrals, rangeDays])

  return (
    <div className="p-4 rounded-xl bg-[#121826] border border-[#1F2933]">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#f97316]/15 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-[#f97316]" />
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm leading-tight">Convites por dia</h3>
            <p className="text-white/40 text-[11px]">Últimos {rangeDays} dias</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-white text-lg font-bold leading-tight">{total}</p>
          <p className="text-white/40 text-[11px]">no período</p>
        </div>
      </div>

      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="invitesFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f97316" stopOpacity={0.45} />
                <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1F2933" vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#6b7280", fontSize: 11 }}
              dy={6}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#6b7280", fontSize: 11 }}
              width={28}
              domain={[0, (max: number) => Math.max(4, max + 1)]}
            />
            <Tooltip
              cursor={{ stroke: "#f97316", strokeWidth: 1, strokeDasharray: "4 4" }}
              contentStyle={{
                background: "#0a0e17",
                border: "1px solid #1F2933",
                borderRadius: 12,
                color: "#fff",
                fontSize: 12,
              }}
              labelStyle={{ color: "#9ca3af" }}
              formatter={(value: number) => [value + " convite(s)", "Convites"]}
            />
            <Area
              type="monotone"
              dataKey="convites"
              stroke="#f97316"
              strokeWidth={2.5}
              fill="url(#invitesFill)"
              dot={{ r: 3, fill: "#f97316", strokeWidth: 0 }}
              activeDot={{ r: 5, fill: "#fb923c", stroke: "#0a0e17", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-3 flex items-center gap-4 border-t border-[#1F2933] pt-3">
        <div className="flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5 text-[#f97316]" />
          <span className="text-white/50 text-[11px]">Total de convites:</span>
          <span className="text-white text-[11px] font-semibold">{total}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-[#26a69a]" />
          <span className="text-white/50 text-[11px]">Melhor dia:</span>
          <span className="text-white text-[11px] font-semibold">{peak}</span>
        </div>
      </div>
    </div>
  )
}
