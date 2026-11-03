"use client"

import { useEffect, useMemo, useState } from "react"
import { Area, AreaChart, CartesianGrid, ReferenceDot, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { fmtUsd } from "@/lib/invest-schedule"
import type { Portfolio } from "@/lib/invest-portfolio"

const GREEN = "#16d98a"

function niceStep(raw: number) {
  const pow = Math.pow(10, Math.floor(Math.log10(raw)))
  const unit = raw / pow
  return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 2.5 ? 2.5 : unit <= 5 ? 5 : 10) * pow
}

const axisUsd = (v: number) =>
  `US$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: v >= 100 ? 0 : 2, notation: v >= 1_000_000 ? "compact" : "standard" })}`

const monthLabel = (t: number) =>
  new Date(t).toLocaleDateString("pt-BR", { month: "short", timeZone: "America/Sao_Paulo" }).replace(".", "").replace(/^./, (c) => c.toUpperCase())

function EvolutionTooltip({ active, payload }: { active?: boolean; payload?: { payload: { time: number; real: number | null; proj: number | null } }[] }) {
  if (!active || !payload?.length) return null
  const p = payload[0].payload
  const value = p.real ?? p.proj ?? 0
  return (
    <div className="rounded-lg border border-iv-line bg-iv-bg/95 px-3 py-2 text-xs shadow-xl">
      <p className="text-iv-muted">
        {new Date(p.time).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}
        {p.real == null ? " · projeção" : ""}
      </p>
      <p className="iv-num mt-0.5 text-sm font-semibold text-iv-ink">{fmtUsd(value)}</p>
    </div>
  )
}

export function EvolutionChart({ portfolio, hidden }: { portfolio: Portfolio; hidden: boolean }) {
  const [animated, setAnimated] = useState(false)
  useEffect(() => {
    const id = setTimeout(() => setAnimated(true), 2500)
    return () => clearTimeout(id)
  }, [])
  const { data, current, ticks, domain, yTicks } = useMemo(() => {
    const pts = portfolio.evolution
    const lastReal = [...pts].reverse().find((p) => !p.projected) ?? pts[0]
    const rows = pts.map((p) => ({
      time: p.time,
      real: p.projected ? null : p.value,
      proj: p.projected || p === lastReal ? p.value : null,
    }))
    const months: number[] = []
    if (pts.length) {
      const d = new Date(pts[0].time)
      d.setUTCDate(1)
      d.setUTCHours(12, 0, 0, 0)
      d.setUTCMonth(d.getUTCMonth() + 1)
      while (d.getTime() <= pts[pts.length - 1].time) {
        months.push(d.getTime())
        d.setUTCMonth(d.getUTCMonth() + 1)
      }
    }
    const values = pts.map((p) => p.value)
    const min = values.length ? Math.min(...values) : 0
    const max = values.length ? Math.max(...values) : 1
    const step = niceStep(Math.max(max - min, max * 0.02, 1) / 5)
    const lo = Math.max(0, Math.floor(min / step) * step)
    const hi = Math.ceil(max / step) * step
    const yTicks: number[] = []
    for (let v = lo; v <= hi + step / 2; v += step) yTicks.push(v)
    return { data: rows, current: lastReal, ticks: months, domain: [lo, hi] as [number, number], yTicks }
  }, [portfolio.evolution])

  return (
    <section
      aria-labelledby="pf-evo"
      className="rounded-2xl border border-iv-line/80 bg-gradient-to-b from-iv-card via-iv-card/90 to-iv-card/50 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.04),0_20px_40px_-28px_rgb(0_0_0/0.9)] iv-rise flex min-w-0 flex-col gap-4 p-5 sm:p-6"
      style={{ animationDelay: "320ms" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="pf-evo" className="text-xl font-semibold text-iv-ink">
          Evolução do Patrimônio
        </h2>
        {current && (
          <span className="iv-num rounded-lg border border-iv-up/30 bg-iv-up/10 px-3 py-1.5 text-base font-bold text-iv-up">
            {hidden ? "US$ ••••••" : fmtUsd(current.value)}
          </span>
        )}
      </div>

      <div className="h-64 w-full sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 12, right: 12, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="pf-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={GREEN} stopOpacity={0.55} />
                <stop offset="100%" stopColor={GREEN} stopOpacity={0.03} />
              </linearGradient>
              <linearGradient id="pf-area-proj" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={GREEN} stopOpacity={0.16} />
                <stop offset="100%" stopColor={GREEN} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="var(--color-iv-line)" strokeOpacity={0.55} vertical={false} />
            <XAxis
              dataKey="time"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              ticks={ticks}
              tickFormatter={monthLabel}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--color-iv-ink)", fillOpacity: 0.8, fontSize: 13 }}
              dy={8}
            />
            <YAxis
              domain={domain}
              ticks={yTicks}
              tickFormatter={(v: number) => (hidden ? "••••" : axisUsd(v))}
              axisLine={false}
              tickLine={false}
              width={hidden ? 44 : 92}
              tick={{ fill: "var(--color-iv-ink)", fillOpacity: 0.8, fontSize: 12 }}
            />
            {!hidden && <Tooltip content={<EvolutionTooltip />} cursor={{ stroke: "var(--color-iv-muted)", strokeDasharray: "3 3" }} />}
            <Area
              type="monotone"
              dataKey="proj"
              stroke={GREEN}
              strokeOpacity={0.6}
              strokeWidth={2}
              strokeDasharray="5 5"
              fill="url(#pf-area-proj)"
              connectNulls={false}
              isAnimationActive={!animated}
              animationBegin={900}
              animationDuration={900}
              animationEasing="ease-out"
            />
            <Area
              type="monotone"
              dataKey="real"
              stroke={GREEN}
              strokeWidth={2.5}
              fill="url(#pf-area)"
              connectNulls={false}
              isAnimationActive={!animated}
              animationBegin={100}
              animationDuration={1200}
              animationEasing="ease-out"
              onAnimationEnd={() => setTimeout(() => setAnimated(true), 1000)}
              activeDot={{ r: 5, fill: GREEN, stroke: "var(--color-iv-ink)", strokeWidth: 2 }}
            />
            {current && animated && (
              <ReferenceDot
                x={current.time}
                y={current.value}
                r={6}
                fill={GREEN}
                stroke="var(--color-iv-ink)"
                strokeWidth={2}
                className="iv-pop"
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <p className="flex items-center gap-4 text-xs text-iv-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 rounded-full bg-[#16d98a]" aria-hidden /> Realizado
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0 w-4 border-t-2 border-dashed border-[#16d98a]/60" aria-hidden /> Projeção até o resgate
        </span>
      </p>
    </section>
  )
}
