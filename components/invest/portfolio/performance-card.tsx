"use client"

import { useEffect, useState } from "react"
import { TrendingUp } from "lucide-react"
import { useCountUp } from "../use-count-up"
import { fmtDate } from "@/lib/invest-schedule"
import { fmtPct, type Portfolio } from "@/lib/invest-portfolio"

export function PerformanceCard({ portfolio }: { portfolio: Portfolio }) {
  const pct = portfolio.monthlyRate * 100
  const progress = Math.round(portfolio.cycleProgress * 100)
  const shownPct = useCountUp(pct, 1100)
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <section
      id="rentabilidade"
      aria-labelledby="pf-perf"
      className="rounded-2xl border border-iv-line/80 bg-gradient-to-b from-iv-card via-iv-card/90 to-iv-card/50 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.04),0_20px_40px_-28px_rgb(0_0_0/0.9)] iv-rise flex scroll-mt-32 flex-col gap-6 p-6"
      style={{ animationDelay: "240ms" }}
    >
      <h2 id="pf-perf" className="text-lg font-semibold text-iv-ink">
        Rentabilidade da Carteira
      </h2>

      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <span
            className="iv-num text-[2.6rem] font-bold leading-none text-iv-up xl:text-5xl"
            style={{ textShadow: "0 0 24px rgb(34 197 94 / 0.35)" }}
          >
            +{fmtPct(shownPct)}
          </span>
          <span className="text-xl text-iv-sky">ao mês</span>
        </div>
        <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-iv-line/50">
          <TrendingUp className="size-7 text-iv-ink" aria-hidden />
        </span>
      </div>

      <div className="mt-auto flex flex-col gap-3 border-t border-iv-line/70 pt-5">
        <div className="flex items-center justify-between text-[15px]">
          <span className="text-iv-ink/90">Meta Mensal</span>
          <span className="iv-num font-bold text-iv-ink">{fmtPct(pct)}</span>
        </div>
        <div
          className="h-3 overflow-hidden rounded-full bg-iv-line/70"
          role="progressbar"
          aria-label="Progresso até o próximo rendimento"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-iv-up to-[#2ff0a0] transition-[width] delay-300 duration-[1200ms] ease-out"
            style={{ width: mounted ? `${progress}%` : "0%", boxShadow: "0 0 14px rgb(34 197 94 / 0.55)" }}
          />
        </div>
        <div className="flex items-center justify-between gap-3 text-sm text-iv-muted">
          <span>{portfolio.nextPayoutAt ? `Próximo rendimento: ${fmtDate(portfolio.nextPayoutAt)}` : "Sem rendimentos pendentes"}</span>
          <span className="iv-num text-iv-ink">{progress}%</span>
        </div>
      </div>
    </section>
  )
}
