"use client"

import { useState } from "react"
import { mutate as globalMutate } from "swr"
import { toast } from "sonner"
import { CalendarDays, Loader2, Lock, ShieldCheck, Wallet } from "lucide-react"
import { fmtDate, fmtUsd, type InvestmentView } from "@/lib/invest-schedule"
import { useCountUp } from "./use-count-up"

function InvestmentCard({ inv, index }: { inv: InvestmentView; index: number }) {
  const [busy, setBusy] = useState(false)
  const amount = useCountUp(inv.amount, 900)
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
    <li
      className="iv-rise flex flex-col gap-4 rounded-xl border border-iv-line bg-iv-bg/70 p-4"
      style={{ animationDelay: `${500 + index * 100}ms` }}
    >
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="flex flex-1 flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-iv-muted">Investimento atual</span>
            {done ? (
              <span className="rounded-full bg-iv-line px-2.5 py-0.5 text-xs text-iv-muted">Finalizado</span>
            ) : (
              <span className="flex items-center gap-1.5 rounded-full bg-iv-up/15 px-2.5 py-0.5 text-xs text-iv-up">
                <span className="iv-live size-1.5 rounded-full bg-iv-up" aria-hidden />
                Ativo
              </span>
            )}
          </div>
          <span className="font-mono text-2xl font-bold tabular-nums text-iv-ink">{fmtUsd(amount)}</span>
          <span className="text-xs text-iv-muted">
            {inv.payoutsDone}/{inv.months} rendimentos liberados
          </span>
        </div>
        <div className="flex flex-col gap-3 border-t border-iv-line pt-4 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
          <div className="flex flex-col gap-1">
            <span className="text-sm text-iv-muted">Rendimento mensal ({Math.round(inv.monthlyRate * 100)}%)</span>
            <span className="font-mono font-semibold tabular-nums text-iv-ink">{fmtUsd(inv.monthlyYield)}</span>
          </div>
          {inv.nextPayoutAt && (
            <div className="flex flex-col gap-1">
              <span className="text-sm text-iv-muted">Próximo saque</span>
              <span className="flex items-center gap-2 font-mono tabular-nums text-iv-ink">
                <CalendarDays className="size-5 text-iv-muted" aria-hidden />
                {fmtDate(inv.nextPayoutAt)}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-iv-line pt-4">
        <Lock className="size-5 shrink-0 text-iv-muted" aria-hidden />
        <div className="flex flex-col text-sm">
          <span className="text-iv-muted">Valor liberado após 3 meses ({fmtDate(inv.unlockAt)})</span>
          <span className="text-iv-ink">
            {fmtUsd(inv.amount)} <span className="text-iv-muted">(valor investido)</span>
          </span>
        </div>
      </div>

      {!done && (
        <button
          type="button"
          onClick={withdraw}
          disabled={busy || inv.available <= 0}
          className="flex h-11 items-center justify-center gap-2 rounded-lg border border-iv-blue/60 text-sm font-medium text-iv-sky transition-all hover:bg-iv-blue/15 active:scale-[0.98] disabled:border-iv-line disabled:text-iv-muted"
        >
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {inv.available > 0 ? `Sacar ${fmtUsd(inv.available)}` : "Nenhum valor disponível para saque"}
        </button>
      )}
    </li>
  )
}

export function MyInvestments({ investments, loading }: { investments: InvestmentView[]; loading: boolean }) {
  return (
    <section
      aria-labelledby="mine-title"
      className="iv-rise flex flex-col gap-4 rounded-2xl border border-iv-line bg-iv-card/80 p-5"
      style={{ animationDelay: "460ms" }}
    >
      <div className="flex items-center gap-3">
        <Wallet className="size-7 text-iv-sky" aria-hidden />
        <h2 id="mine-title" className="text-xl font-semibold text-iv-ink">
          Seus investimentos
        </h2>
      </div>
      {loading ? (
        <div className="h-40 animate-pulse rounded-xl bg-iv-bg/70" />
      ) : investments.length === 0 ? (
        <p className="rounded-xl border border-dashed border-iv-line p-5 text-center text-sm leading-relaxed text-iv-muted">
          Você ainda não tem investimentos. Simule um valor e confirme para começar a receber 10% ao mês.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {investments.map((inv, i) => (
            <InvestmentCard key={inv.id} inv={inv} index={i} />
          ))}
        </ul>
      )}
    </section>
  )
}

export function TrustCard() {
  return (
    <section
      className="iv-rise flex items-start gap-4 rounded-2xl border border-iv-line bg-iv-card/80 p-5"
      style={{ animationDelay: "560ms" }}
    >
      <ShieldCheck className="size-9 shrink-0 text-iv-sky" aria-hidden />
      <div className="flex flex-col gap-1">
        <h2 className="font-medium text-iv-sky">Seguro e confiável</h2>
        <p className="text-sm leading-relaxed text-iv-ink/85">
          Seus investimentos são protegidos por tecnologia de ponta e <strong>criptografia</strong>, garantindo a
          segurança do seu capital na Kryptobit.
        </p>
      </div>
    </section>
  )
}
