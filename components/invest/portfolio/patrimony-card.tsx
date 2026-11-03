"use client"

import { Eye, EyeOff, SquareArrowOutUpRight, Triangle } from "lucide-react"
import { fmtUsd } from "@/lib/invest-schedule"
import { fmtPct, type Portfolio } from "@/lib/invest-portfolio"
import { useCountUp } from "../use-count-up"

export const mask = (hidden: boolean, text: string) => (hidden ? "US$ ••••••" : text)

export function PatrimonyCard({
  portfolio,
  hidden,
  onToggleHidden,
  onInvest,
  onPrefetch,
}: {
  portfolio: Portfolio
  hidden: boolean
  onToggleHidden: () => void
  onInvest: () => void
  onPrefetch?: () => void
}) {
  const total = useCountUp(portfolio.total, 1100)
  const monthlyYield = useCountUp(portfolio.monthlyYield, 1100)
  const monthlyPct = portfolio.monthlyRate * 100

  return (
    <section aria-labelledby="pf-total" className="rounded-2xl border border-iv-line/80 bg-gradient-to-b from-iv-card via-iv-card/90 to-iv-card/50 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.04),0_20px_40px_-28px_rgb(0_0_0/0.9)] iv-rise flex flex-col gap-5 p-6" style={{ animationDelay: "80ms" }}>
      <div className="flex items-center justify-between gap-3">
        <h2 id="pf-total" className="text-lg font-semibold text-iv-ink">
          Patrimônio Total
        </h2>
        <button
          type="button"
          onClick={onToggleHidden}
          aria-label={hidden ? "Mostrar valores" : "Ocultar valores"}
          className="-mr-2 flex size-10 items-center justify-center rounded-full text-iv-ink/80 transition-colors hover:bg-iv-line/50 hover:text-iv-ink"
        >
          {hidden ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
        </button>
      </div>

      <div className="flex flex-col items-start gap-3">
        <p className="iv-num text-[2.15rem] font-bold leading-none text-iv-ink lg:text-[2.5rem]" aria-live="polite">
          {mask(hidden, fmtUsd(total))}
        </p>
        <span className="flex items-center gap-1.5 rounded-md border border-iv-up/25 bg-iv-up/10 px-2.5 py-1 text-sm font-semibold text-iv-up">
          <Triangle className="size-3 fill-current" aria-hidden />
          <span className="iv-num">+{fmtPct(monthlyPct)}</span>
          <span className="font-medium">ao mês</span>
        </span>
      </div>

      <dl className="flex flex-col divide-y divide-iv-line/70 border-t border-iv-line/70">
        <div className="flex items-center justify-between gap-3 py-3.5">
          <dt className="text-[15px] text-iv-ink/90">Rendimento Mensal</dt>
          <dd className="iv-num text-lg font-bold text-iv-up">{mask(hidden, fmtUsd(monthlyYield))}</dd>
        </div>
        <div className="flex items-center justify-between gap-3 py-3.5">
          <dt className="text-[15px] text-iv-ink/90">Rendimento Anual (aprox.)</dt>
          <dd className="iv-num text-lg font-bold text-iv-up">+{fmtPct(portfolio.annualPct, 1)}</dd>
        </div>
      </dl>

      <button
        type="button"
        onClick={onInvest}
        onPointerEnter={onPrefetch}
        onFocus={onPrefetch}
        className="iv-btn mt-auto flex h-14 items-center justify-center gap-2.5 rounded-xl text-base font-semibold text-iv-ink transition-transform active:scale-[0.98]"
      >
        <SquareArrowOutUpRight className="size-5" aria-hidden />
        Aportar
      </button>
    </section>
  )
}
