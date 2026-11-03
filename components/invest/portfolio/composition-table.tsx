"use client"

import { fmtUsd } from "@/lib/invest-schedule"
import { fmtPct, type Portfolio } from "@/lib/invest-portfolio"
import { mask } from "./patrimony-card"

export function CompositionTable({ portfolio, hidden }: { portfolio: Portfolio; hidden: boolean }) {
  const { slices, invested, monthlyRate } = portfolio

  return (
    <section
      id="ativos"
      aria-labelledby="pf-comp"
      className="rounded-2xl border border-iv-line/80 bg-gradient-to-b from-iv-card via-iv-card/90 to-iv-card/50 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.04),0_20px_40px_-28px_rgb(0_0_0/0.9)] iv-rise flex min-w-0 scroll-mt-32 flex-col gap-4 p-5 sm:p-6"
      style={{ animationDelay: "400ms" }}
    >
      <h2 id="pf-comp" className="text-xl font-semibold text-iv-ink">
        Composição e Rentabilidade dos Ativos
      </h2>

      <ul className="flex flex-col divide-y divide-iv-line/60 border-y border-iv-line/60 sm:hidden">
        {slices.length === 0 ? (
          <li className="py-8 text-center text-sm text-iv-muted">Faça seu primeiro aporte para ver a composição da carteira.</li>
        ) : (
          slices.map((s) => (
            <li key={s.asset.id} className="flex items-center gap-3 py-3">
              <span
                className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full ring-2"
                style={{ ["--tw-ring-color" as string]: s.color, boxShadow: `0 0 12px ${s.color}66` }}
              >
                <img src={s.asset.logo} alt="" width={40} height={40} loading="lazy" decoding="async" className="size-full object-cover" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[15px] font-medium text-iv-ink">{s.asset.name}</span>
                <span className="iv-num text-xs text-iv-muted">
                  {s.asset.ticker} · {Math.round(s.share * 100)}%
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end">
                <span className="iv-num text-[15px] font-semibold text-iv-ink">{mask(hidden, fmtUsd(s.value))}</span>
                <span className="iv-num text-xs font-bold text-iv-up">+{fmtPct(s.rate * 100)} a.m.</span>
              </span>
            </li>
          ))
        )}
        {slices.length > 0 && (
          <li className="flex items-center justify-between gap-3 py-4 font-bold text-iv-ink">
            <span>Total da Carteira</span>
            <span className="flex flex-col items-end">
              <span className="iv-num">{mask(hidden, fmtUsd(invested))}</span>
              <span className="iv-num text-xs text-iv-up">+{fmtPct(monthlyRate * 100)} a.m.</span>
            </span>
          </li>
        )}
      </ul>

      <div className="hidden sm:block">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-iv-line/70 text-sm text-iv-ink/80">
              <th scope="col" className="py-3 pr-3 font-normal">
                Classe de Ativo
              </th>
              <th scope="col" className="px-3 py-3 text-right font-normal">
                Valor Alocado
              </th>
              <th scope="col" className="px-3 py-3 text-right font-normal">
                Participação
              </th>
              <th scope="col" className="py-3 pl-3 text-right font-normal">
                Rentabilidade (a.m.)
              </th>
            </tr>
          </thead>
          <tbody>
            {slices.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-sm text-iv-muted">
                  Faça seu primeiro aporte para ver a composição da carteira.
                </td>
              </tr>
            ) : (
              slices.map((s) => (
                <tr key={s.asset.id} className="border-b border-iv-line/50">
                  <td className="py-3 pr-3">
                    <span className="flex items-center gap-3">
                      <span
                        className="relative flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full ring-2"
                        style={{ ["--tw-ring-color" as string]: s.color, boxShadow: `0 0 12px ${s.color}66` }}
                      >
                        <img src={s.asset.logo} alt="" width={40} height={40} loading="lazy" decoding="async" className="size-full object-cover" />
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-[15px] font-medium text-iv-ink">{s.asset.name}</span>
                        <span className="iv-num text-xs text-iv-muted">{s.asset.ticker}</span>
                      </span>
                    </span>
                  </td>
                  <td className="iv-num px-3 py-3 text-right text-[15px] text-iv-ink">{mask(hidden, fmtUsd(s.value))}</td>
                  <td className="iv-num px-3 py-3 text-right text-[15px] text-iv-ink">{Math.round(s.share * 100)}%</td>
                  <td className="iv-num py-3 pl-3 text-right text-[15px] font-bold text-iv-up">+{fmtPct(s.rate * 100)}</td>
                </tr>
              ))
            )}
          </tbody>
          {slices.length > 0 && (
            <tfoot>
              <tr className="border-b border-iv-line/50 text-base font-bold text-iv-ink">
                <th scope="row" className="py-4 pr-3 text-left">
                  Total da Carteira
                </th>
                <td className="iv-num px-3 py-4 text-right">{mask(hidden, fmtUsd(invested))}</td>
                <td className="iv-num px-3 py-4 text-right">100%</td>
                <td className="iv-num py-4 pl-3 text-right text-iv-up">+{fmtPct(monthlyRate * 100)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  )
}
