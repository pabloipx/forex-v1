"use client"

import { useMemo } from "react"
import { Bell, CalendarClock, Wallet } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { getInvestAsset } from "@/lib/invest-assets"
import { fmtDate, fmtUsd, payoutAt, type InvestmentView } from "@/lib/invest-schedule"
import { investFontVars } from "@/lib/invest-fonts"
import { cn } from "@/lib/utils"

export function Notifications({ investments }: { investments: InvestmentView[] }) {
  const { upcoming, available } = useMemo(() => {
    const now = Date.now()
    const list: { key: string; date: string; asset: string; value: number }[] = []
    for (const inv of investments) {
      if (inv.status !== "active") continue
      const start = new Date(inv.startedAt)
      for (let k = inv.payoutsDone + 1; k <= inv.months; k++) {
        const date = payoutAt(start, k)
        if (date.getTime() > now) {
          list.push({ key: `${inv.id}-${k}`, date: date.toISOString(), asset: inv.asset, value: inv.monthlyYield + (k === inv.months ? inv.amount : 0) })
        }
      }
    }
    list.sort((a, b) => a.date.localeCompare(b.date))
    return { upcoming: list.slice(0, 5), available: investments.reduce((s, i) => s + i.available, 0) }
  }, [investments])

  const hasAlert = available > 0

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={hasAlert ? "Notificações: há valor disponível para saque" : "Notificações"}
          className="relative flex size-10 items-center justify-center rounded-full text-iv-ink/90 transition-colors hover:bg-iv-card hover:text-iv-ink data-[state=open]:bg-iv-card lg:size-11"
        >
          <Bell className="size-5 lg:size-6" />
          {hasAlert && <span className="iv-live absolute right-2 top-2 size-2 rounded-full bg-iv-up ring-2 ring-iv-bg" aria-hidden />}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={8}
        className={cn(investFontVars, "iv-theme w-80 rounded-2xl border-iv-line bg-iv-card p-0 font-sans text-iv-ink shadow-2xl")}
      >
        <div className="border-b border-iv-line/70 px-4 py-3">
          <p className="text-sm font-semibold">Notificações</p>
        </div>
        <ul className="flex max-h-80 flex-col divide-y divide-iv-line/60 overflow-y-auto">
          {hasAlert && (
            <li className="flex items-start gap-3 px-4 py-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-iv-up/15 text-iv-up">
                <Wallet className="size-4" aria-hidden />
              </span>
              <p className="text-sm leading-relaxed text-iv-ink/90">
                Você tem <span className="iv-num font-semibold text-iv-up">{fmtUsd(available)}</span> disponível para saque no Extrato.
              </p>
            </li>
          )}
          {upcoming.map((p) => (
            <li key={p.key} className="flex items-start gap-3 px-4 py-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-iv-blue/15 text-iv-sky">
                <CalendarClock className="size-4" aria-hidden />
              </span>
              <p className="text-sm leading-relaxed text-iv-ink/90">
                <span className="iv-num font-semibold text-iv-ink">{fmtUsd(p.value)}</span> de {getInvestAsset(p.asset).name} em{" "}
                <span className="iv-num">{fmtDate(p.date)}</span>
              </p>
            </li>
          ))}
          {!hasAlert && upcoming.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-iv-muted">Nenhuma notificação por enquanto.</li>
          )}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
