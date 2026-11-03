"use client"

import { useEffect, useState } from "react"
import { Cell, Pie, PieChart, ResponsiveContainer, type PieLabelRenderProps } from "recharts"
import { useCountUp } from "../use-count-up"
import { fmtUsd } from "@/lib/invest-schedule"
import { fmtPct, type Portfolio } from "@/lib/invest-portfolio"
import { mask } from "./patrimony-card"

const RAD = Math.PI / 180

function SliceLabel(props: PieLabelRenderProps) {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props as PieLabelRenderProps & {
    cx: number
    cy: number
    midAngle: number
    innerRadius: number
    outerRadius: number
    percent: number
  }
  if (percent < 0.06) return null
  const r = innerRadius + (outerRadius - innerRadius) / 2
  const x = cx + r * Math.cos(-midAngle * RAD)
  const y = cy + r * Math.sin(-midAngle * RAD)
  return (
    <text x={x} y={y} textAnchor="middle" dominantBaseline="central" className="iv-num fill-iv-ink text-[13px] font-bold sm:text-[15px]">
      {`${Math.round(percent * 100)}%`}
    </text>
  )
}

export function AllocationCard({ portfolio, hidden }: { portfolio: Portfolio; hidden: boolean }) {
  const { slices, invested, monthlyRate } = portfolio
  const [animated, setAnimated] = useState(false)
  useEffect(() => {
    const id = setTimeout(() => setAnimated(true), 2000)
    return () => clearTimeout(id)
  }, [])
  const shownInvested = useCountUp(invested, 1100)

  return (
    <section
      aria-label="Distribuição da carteira"
      className="rounded-2xl border border-iv-line/80 bg-gradient-to-b from-iv-card via-iv-card/90 to-iv-card/50 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.04),0_20px_40px_-28px_rgb(0_0_0/0.9)] iv-rise flex flex-col items-center gap-6 p-5 sm:flex-row sm:gap-8 sm:p-6"
      style={{ animationDelay: "160ms" }}
    >
      <div className="relative aspect-square w-full max-w-[290px] shrink-0 sm:w-[44%]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <defs>
              <filter id="pf-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="6" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <Pie
              data={slices.length ? slices : [{ value: 1 }]}
              dataKey="value"
              innerRadius="58%"
              outerRadius="98%"
              startAngle={90}
              endAngle={-270}
              stroke="var(--color-iv-bg)"
              strokeWidth={2}
              label={slices.length ? SliceLabel : false}
              labelLine={false}
              isAnimationActive={!animated}
              animationBegin={150}
              animationDuration={1100}
              animationEasing="ease-out"
              onAnimationEnd={() => setAnimated(true)}
              style={{ filter: "url(#pf-glow)" }}
            >
              {slices.length ? (
                slices.map((s) => <Cell key={s.asset.id} fill={s.color} />)
              ) : (
                <Cell fill="var(--color-iv-line)" />
              )}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-1 text-center">
          <span className="text-sm text-iv-ink/85 sm:text-base">Carteira</span>
          <span className="iv-num px-6 text-base font-bold leading-tight text-iv-ink sm:text-lg">
            {mask(hidden, fmtUsd(shownInvested))}
          </span>
          <span className="iv-num text-sm font-semibold text-iv-up sm:text-base">{fmtPct(monthlyRate * 100)} a.m.</span>
        </div>
      </div>

      <ul className="flex w-full min-w-0 flex-1 flex-col divide-y divide-iv-line/70">
        {slices.length === 0 ? (
          <li className="py-6 text-center text-sm text-iv-muted">Nenhum ativo na carteira ainda.</li>
        ) : (
          slices.map((s, i) => (
            <li key={s.asset.id} className="iv-rise flex items-center gap-3 py-4" style={{ animationDelay: `${300 + i * 90}ms` }}>
              <span className="size-3.5 shrink-0 rounded-full" style={{ backgroundColor: s.color, boxShadow: `0 0 10px ${s.color}` }} aria-hidden />
              <span className="line-clamp-2 min-w-0 flex-1 text-[15px] font-medium leading-snug text-iv-ink">
                {s.asset.name} <span className="text-iv-ink/70">({s.asset.ticker})</span>
              </span>
              <span className="iv-num w-11 shrink-0 text-right text-[15px] font-semibold text-iv-ink">{Math.round(s.share * 100)}%</span>
              <span className="iv-num hidden shrink-0 text-right text-[15px] text-iv-ink/90 min-[420px]:inline">
                {mask(hidden, fmtUsd(s.value))}
              </span>
            </li>
          ))
        )}
      </ul>
    </section>
  )
}
