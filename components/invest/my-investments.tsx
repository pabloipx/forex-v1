"use client"

import { useState } from "react"
import { mutate as globalMutate } from "swr"
import { toast } from "sonner"
import { CalendarDays, Loader2, Lock, ShieldCheck } from "lucide-react"
import { fmtDate, fmtUsd, type InvestmentView } from "@/lib/invest-schedule"
import { useCountUp } from "./use-count-up"
import { getInvestAsset } from "@/lib/invest-assets"

const RING = 2 * Math.PI * 26

function PayoutRing({ done, total }: { done: number; total: number }) {
  const offset = RING * (1 - done / total)
  return (
    <div className="relative size-16 shrink-0">
      <svg viewBox="0 0 64 64" className="size-16 -rotate-90" aria-hidden>
        <circle cx="32" cy="32" r="26" fill="none" strokeWidth="4" className="stroke-iv-line" />
        <circle
          cx="32"
          cy="32"
          r="26"
          fill="none"
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={RING}
          strokeDashoffset={offset}
          className="iv-draw stroke-iv-sky"
          style={{ ["--iv-len" as string]: RING }}
        />
      </svg>
      <span className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="iv-num text-base font-semibold text-iv-ink">
          {done}/{total}
        </span>
        <span className="mt-0.5 text-[9px] uppercase tracking-wider text-iv-muted">pagos</span>
      </span>
    </div>
  )
}

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
      className="iv-rise iv-inset flex flex-col gap-5 rounded-2xl p-5"
      style={{ animationDelay: `${500 + index * 100}ms` }}
    >
      <div className="flex items-center gap-4">
        <PayoutRing done={inv.payoutsDone} total={inv.months} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-sm text-iv-muted">
              {getInvestAsset(inv.asset).name} <span className="iv-num text-iv-ink/80">{getInvestAsset(inv.asset).ticker}</span>
            </span>
            {done ? (
              <span className="rounded-full border border-iv-line px-2.5 py-0.5 text-xs text-iv-muted">Finalizado</span>
            ) : (
              <span className="flex items-center gap-1.5 rounded-full border border-iv-up/30 bg-iv-up/10 px-2.5 py-0.5 text-xs font-medium text-iv-up">
                <span className="iv-live size-1.5 rounded-full bg-iv-up" aria-hidden />
                Ativo
              </span>
            )}
          </div>
          <span className="iv-num text-2xl font-semibold text-iv-ink">{fmtUsd(amount)}</span>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-iv-line/70">
        <div className="flex flex-col gap-1 bg-iv-card p-3.5">
          <dt className="text-xs text-iv-muted">Rendimento ({Math.round(inv.monthlyRate * 100)}%)</dt>
          <dd className="iv-num text-base font-semibold text-iv-sky">+{fmtUsd(inv.monthlyYield)}</dd>
        </div>
        <div className="flex flex-col gap-1 bg-iv-card p-3.5">
          <dt className="text-xs text-iv-muted">Próximo saque</dt>
          <dd className="iv-num flex items-center gap-1.5 text-base font-semibold text-iv-ink">
            <CalendarDays className="size-4 text-iv-muted" aria-hidden />
            {inv.nextPayoutAt ? fmtDate(inv.nextPayoutAt) : "—"}
          </dd>
        </div>
        <div className="col-span-2 flex items-center gap-3 bg-iv-card p-3.5">
          <Lock className="size-4 shrink-0 text-iv-gold" aria-hidden />
          <div className="flex flex-1 items-center justify-between gap-2 text-sm">
            <span className="text-iv-muted">Liberado em {fmtDate(inv.unlockAt)}</span>
            <span className="iv-num font-semibold text-iv-ink">{fmtUsd(inv.amount)}</span>
          </div>
        </div>
      </dl>

      {!done && (
        <button
          type="button"
          onClick={withdraw}
          disabled={busy || inv.available <= 0}
          className="iv-num flex h-12 items-center justify-center gap-2 rounded-xl border border-iv-sky/40 bg-iv-blue/10 text-sm font-semibold text-iv-sky transition-all hover:bg-iv-blue/20 active:scale-[0.98] disabled:border-iv-line disabled:bg-transparent disabled:font-medium disabled:text-iv-muted"
        >
          {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
          {inv.available > 0 ? `Sacar ${fmtUsd(inv.available)}` : "Nenhum valor disponível para saque"}
        </button>
      )}
    </li>
  )
}

export function MyInvestments({ investments, loading }: { investments: InvestmentView[]; loading: boolean }) {
  const totalInvested = investments.filter((i) => i.status !== "completed").reduce((s, i) => s + i.amount, 0)
  const total = useCountUp(totalInvested, 900)
  return (
    <section
      aria-labelledby="mine-title"
      className="iv-rise iv-panel flex flex-col gap-5 rounded-3xl p-5 md:p-7"
      style={{ animationDelay: "460ms" }}
    >
      <header className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-2">
          <span className="iv-eyebrow text-iv-gold">Carteira</span>
          <h2 id="mine-title" className="font-display text-3xl leading-tight text-iv-ink">
            Seus investimentos
          </h2>
        </div>
        {investments.length > 0 && (
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-xs text-iv-muted">Aplicado</span>
            <span className="iv-num text-base font-semibold text-iv-ink">{fmtUsd(total)}</span>
          </div>
        )}
      </header>
      {loading ? (
        <div className="h-48 animate-pulse rounded-2xl bg-iv-bg/70" />
      ) : investments.length === 0 ? (
        <div className="iv-inset flex flex-col items-center gap-3 rounded-2xl px-5 py-8 text-center">
          <PayoutRing done={0} total={3} />
          <p className="max-w-xs text-pretty text-sm leading-relaxed text-iv-muted">
            Você ainda não tem investimentos. Simule um valor e confirme para começar a receber{" "}
            <span className="font-semibold text-iv-ink">10% ao mês</span>.
          </p>
        </div>
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
      className="iv-rise iv-panel flex items-start gap-4 rounded-3xl p-5 md:p-6"
      style={{ animationDelay: "560ms" }}
    >
      <span className="iv-float flex size-12 shrink-0 items-center justify-center rounded-2xl border border-iv-sky/30 bg-iv-blue/10">
        <ShieldCheck className="size-6 text-iv-sky" aria-hidden />
      </span>
      <div className="flex flex-col gap-1.5">
        <h2 className="font-display text-xl text-iv-ink">Seguro e confiável</h2>
        <p className="text-sm leading-relaxed text-iv-muted">
          Seus investimentos são protegidos por tecnologia de ponta e{" "}
          <span className="font-semibold text-iv-ink">criptografia</span>, garantindo a segurança do seu capital na
          Kryptobit.
        </p>
      </div>
    </section>
  )
}
