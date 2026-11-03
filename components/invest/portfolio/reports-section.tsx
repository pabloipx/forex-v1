"use client"

import { useMemo } from "react"
import { getInvestAsset } from "@/lib/invest-assets"
import { fmtDate, fmtUsd, payoutAt, type InvestmentView } from "@/lib/invest-schedule"
import { cn } from "@/lib/utils"
import { mask } from "./patrimony-card"

interface Payout {
  key: string
  date: string
  asset: string
  label: string
  value: number
  paid: boolean
}

export function ReportsSection({ investments, hidden }: { investments: InvestmentView[]; hidden: boolean }) {
  const { rows, received, upcoming } = useMemo(() => {
    const list: Payout[] = []
    for (const inv of investments) {
      const start = new Date(inv.startedAt)
      for (let k = 1; k <= inv.months; k++) {
        const paid = k <= inv.payoutsDone
        list.push({
          key: `${inv.id}-${k}`,
          date: payoutAt(start, k).toISOString(),
          asset: inv.asset,
          label: k === inv.months ? `Rendimento ${k}/${inv.months} + resgate` : `Rendimento ${k}/${inv.months}`,
          value: inv.monthlyYield + (k === inv.months ? inv.amount : 0),
          paid,
        })
      }
    }
    list.sort((a, b) => a.date.localeCompare(b.date))
    return {
      rows: list,
      received: list.filter((p) => p.paid).reduce((s, p) => s + p.value, 0),
      upcoming: list.filter((p) => !p.paid).reduce((s, p) => s + p.value, 0),
    }
  }, [investments])

  return (
    <section id="relatorios" aria-labelledby="pf-rep" className="rounded-2xl border border-iv-line/80 bg-gradient-to-b from-iv-card via-iv-card/90 to-iv-card/50 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.04),0_20px_40px_-28px_rgb(0_0_0/0.9)] iv-rise flex scroll-mt-32 flex-col gap-4 p-5 sm:p-6" style={{ animationDelay: "560ms" }}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 id="pf-rep" className="text-xl font-semibold text-iv-ink">
          Relatórios
        </h2>
        <dl className="flex gap-6 text-sm">
          <div className="flex flex-col items-end">
            <dt className="text-iv-muted">Já recebido</dt>
            <dd className="iv-num font-bold text-iv-up">{mask(hidden, fmtUsd(received))}</dd>
          </div>
          <div className="flex flex-col items-end">
            <dt className="text-iv-muted">A receber</dt>
            <dd className="iv-num font-bold text-iv-ink">{mask(hidden, fmtUsd(upcoming))}</dd>
          </div>
        </dl>
      </div>

      {rows.length === 0 ? (
        <p className="py-4 text-sm text-iv-muted">O calendário de rendimentos aparece aqui depois do primeiro aporte.</p>
      ) : (
        <div className="-mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-iv-line/70 text-iv-ink/80">
                <th scope="col" className="py-3 pr-3 font-normal">
                  Data
                </th>
                <th scope="col" className="px-3 py-3 font-normal">
                  Ativo
                </th>
                <th scope="col" className="px-3 py-3 font-normal">
                  Lançamento
                </th>
                <th scope="col" className="px-3 py-3 text-right font-normal">
                  Valor
                </th>
                <th scope="col" className="py-3 pl-3 text-right font-normal">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.key} className="border-b border-iv-line/40">
                  <td className="iv-num py-3 pr-3 text-iv-ink">{fmtDate(p.date)}</td>
                  <td className="px-3 py-3 text-iv-ink">{getInvestAsset(p.asset).name}</td>
                  <td className="px-3 py-3 text-iv-muted">{p.label}</td>
                  <td className="iv-num px-3 py-3 text-right font-semibold text-iv-ink">{mask(hidden, fmtUsd(p.value))}</td>
                  <td className="py-3 pl-3 text-right">
                    <span
                      className={cn(
                        "rounded-full border px-2.5 py-0.5 text-xs font-medium",
                        p.paid ? "border-iv-up/30 bg-iv-up/10 text-iv-up" : "border-iv-line text-iv-muted",
                      )}
                    >
                      {p.paid ? "Pago" : "Previsto"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
