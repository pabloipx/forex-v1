"use client"

import { useState } from "react"
import { mutate as globalMutate } from "swr"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { getInvestAsset } from "@/lib/invest-assets"
import { fmtDate, fmtUsd, type InvestmentView } from "@/lib/invest-schedule"
import { cn } from "@/lib/utils"
import { mask } from "./patrimony-card"

function StatementRow({ inv, hidden }: { inv: InvestmentView; hidden: boolean }) {
  const [busy, setBusy] = useState(false)
  const asset = getInvestAsset(inv.asset)
  const done = inv.status === "completed"

  const withdraw = async () => {
    setBusy(true)
    try {
      const res = await fetch("/api/invest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "withdraw", id: inv.id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Não foi possível sacar")
      toast.success(`${fmtUsd(json.result.total)} enviado para seu saldo`)
      await Promise.all([globalMutate("/api/invest"), globalMutate("/api/futures/state?account=real")])
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="flex flex-col gap-4 py-4 lg:flex-row lg:items-center lg:gap-6">
      <div className="flex min-w-0 items-center gap-3 lg:w-72">
        <img src={asset.logo} alt="" width={40} height={40} loading="lazy" decoding="async" className="size-10 shrink-0 rounded-full object-cover ring-1 ring-iv-line" />
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[15px] font-semibold text-iv-ink">{asset.name}</span>
          <span className="text-xs text-iv-muted">Aplicado em {fmtDate(inv.startedAt)}</span>
        </div>
        <span
          className={cn(
            "ml-auto shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium lg:hidden",
            done ? "border-iv-line text-iv-muted" : "border-iv-up/30 bg-iv-up/10 text-iv-up",
          )}
        >
          {done ? "Finalizado" : "Ativo"}
        </span>
      </div>

      <dl className="grid flex-1 grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
        <div className="flex flex-col gap-0.5">
          <dt className="text-iv-muted">Investido</dt>
          <dd className="iv-num font-semibold text-iv-ink">{mask(hidden, fmtUsd(inv.amount))}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-iv-muted">Rendimento/mês</dt>
          <dd className="iv-num font-semibold text-iv-up">+{mask(hidden, fmtUsd(inv.monthlyYield))}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-iv-muted">Rendimentos</dt>
          <dd className="iv-num font-semibold text-iv-ink">
            {inv.payoutsDone} de {inv.months}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-iv-muted">{done ? "Resgatado em" : "Resgate em"}</dt>
          <dd className="iv-num font-semibold text-iv-ink">{fmtDate(inv.unlockAt)}</dd>
        </div>
      </dl>

      <div className="flex items-center gap-3 lg:w-56 lg:justify-end">
        <span
          className={cn(
            "hidden shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium lg:inline",
            done ? "border-iv-line text-iv-muted" : "border-iv-up/30 bg-iv-up/10 text-iv-up",
          )}
        >
          {done ? "Finalizado" : "Ativo"}
        </span>
        {!done && (
          <button
            type="button"
            onClick={withdraw}
            disabled={busy || inv.available <= 0}
            className="iv-num flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-iv-sky/40 bg-iv-blue/10 px-4 text-sm font-semibold text-iv-sky transition-colors hover:bg-iv-blue/20 disabled:border-iv-line disabled:bg-transparent disabled:font-medium disabled:text-iv-muted lg:flex-none"
          >
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {inv.available > 0 ? `Sacar ${mask(hidden, fmtUsd(inv.available))}` : "Nada a sacar"}
          </button>
        )}
      </div>
    </li>
  )
}

export function StatementSection({
  investments,
  loading,
  hidden,
}: {
  investments: InvestmentView[]
  loading: boolean
  hidden: boolean
}) {
  return (
    <section id="extrato" aria-labelledby="pf-ext" className="rounded-2xl border border-iv-line/80 bg-gradient-to-b from-iv-card via-iv-card/90 to-iv-card/50 shadow-[inset_0_1px_0_0_rgb(255_255_255/0.04),0_20px_40px_-28px_rgb(0_0_0/0.9)] iv-rise flex scroll-mt-32 flex-col gap-2 p-5 sm:p-6" style={{ animationDelay: "480ms" }}>
      <h2 id="pf-ext" className="text-xl font-semibold text-iv-ink">
        Extrato
      </h2>
      {loading ? (
        <div className="h-28 animate-pulse rounded-xl bg-iv-line/30" />
      ) : investments.length === 0 ? (
        <p className="py-6 text-sm text-iv-muted">Nenhum aporte realizado ainda.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-iv-line/70">
          {investments.map((inv) => (
            <StatementRow key={inv.id} inv={inv} hidden={hidden} />
          ))}
        </ul>
      )}
    </section>
  )
}
