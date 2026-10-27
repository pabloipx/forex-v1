"use client"

import { useState } from "react"
import Link from "next/link"
import { mutate as globalMutate } from "swr"
import { toast } from "sonner"
import { ArrowRight, CalendarDays, Loader2 } from "lucide-react"
import { APPLY_DURATION_MS, InvestApplying } from "./invest-applying"
import { cn } from "@/lib/utils"
import { fmtUsd, INVEST_MIN, INVEST_MONTHLY_RATE, INVEST_MONTHS } from "@/lib/invest-schedule"
import { useCountUp } from "./use-count-up"

const PRESETS = [500, 1000, 2000, 5000, 10000]

const parseAmount = (raw: string) => Number(raw.replace(/[^\d,]/g, "").replace(",", "."))
const formatInput = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const shortUsd = (v: number) => (v >= 1000 ? `${(v / 1000).toLocaleString("pt-BR")}k` : String(v))

function Money({ value, className }: { value: number; className?: string }) {
  const [int, dec] = value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).split(",")
  return (
    <span className={cn("iv-num inline-flex items-baseline", className)}>
      <span className="mr-1.5 text-[0.45em] font-medium tracking-normal text-iv-muted">US$</span>
      {int}
      <span className="text-[0.55em] text-iv-ink/50">,{dec}</span>
    </span>
  )
}

function Projection({ amount }: { amount: number }) {
  const monthly = amount * INVEST_MONTHLY_RATE
  const steps = Array.from({ length: INVEST_MONTHS }, (_, i) => ({
    label: `Mês ${i + 1}`,
    value: amount + monthly * (i + 1),
  }))
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="iv-eyebrow text-iv-muted">Projeção</span>
        <span className="iv-num text-xs text-iv-muted">+{Math.round(INVEST_MONTHLY_RATE * INVEST_MONTHS * 100)}% em 3 meses</span>
      </div>
      <div className="flex h-28 items-end gap-3" aria-hidden>
        {steps.map((s, i) => {
          const height = 34 + (46 * (i + 1)) / INVEST_MONTHS
          const yieldPct = 22 + 18 * i
          return (
            <div key={s.label} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
              <span className="iv-num text-[11px] text-iv-ink/80">{fmtUsd(s.value)}</span>
              <div
                className="iv-grow flex w-full flex-col overflow-hidden rounded-t-md"
                style={{ height: `${height}%`, animationDelay: `${600 + i * 140}ms` }}
              >
                <div className="relative w-full flex-none overflow-hidden bg-iv-sky" style={{ flexBasis: `${yieldPct}%` }}>
                  <span className="iv-sweep absolute inset-0 bg-gradient-to-r from-transparent via-iv-ink/40 to-transparent" />
                </div>
                <div className="w-full flex-1 bg-iv-blue/25" />
              </div>
            </div>
          )
        })}
      </div>
      <div className="flex gap-3">
        {steps.map((s) => (
          <span key={s.label} className="flex-1 text-center text-[11px] text-iv-muted">
            {s.label}
          </span>
        ))}
      </div>
      <div className="flex items-center gap-4 text-[11px] text-iv-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-iv-blue/40" aria-hidden /> Valor investido
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-iv-sky" aria-hidden /> Rendimentos
        </span>
      </div>
    </div>
  )
}

export function InvestSimulator({ authenticated, balance }: { authenticated: boolean; balance?: number }) {
  const [raw, setRaw] = useState(formatInput(500))
  const [busy, setBusy] = useState(false)
  const [applying, setApplying] = useState<{ amount: number; startedAt: number; done: boolean } | null>(null)
  const amount = parseAmount(raw)
  const valid = Number.isFinite(amount) && amount >= INVEST_MIN
  const safe = Number.isFinite(amount) ? amount : 0
  const monthly = useCountUp(safe * INVEST_MONTHLY_RATE)
  const total = useCountUp(safe * (1 + INVEST_MONTHLY_RATE * INVEST_MONTHS))
  const insufficient = authenticated && balance !== undefined && valid && amount > balance

  const confirm = async () => {
    if (!valid || busy) return
    const value = Math.round(amount * 100) / 100
    setBusy(true)
    setApplying({ amount: value, startedAt: Date.now(), done: false })
    const minDelay = new Promise((r) => setTimeout(r, APPLY_DURATION_MS))
    try {
      const res = await fetch("/api/invest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: value }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Não foi possível investir")
      await minDelay
      setApplying((a) => (a ? { ...a, done: true } : a))
      await Promise.all([globalMutate("/api/invest"), globalMutate("/api/futures/state?account=real")])
      await new Promise((r) => setTimeout(r, 1800))
      toast.success(`Investimento de ${fmtUsd(json.result.amount)} aplicado`)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setApplying(null)
      setBusy(false)
    }
  }

  return (
    <>
    <section
      aria-labelledby="sim-title"
      className="iv-rise iv-panel flex flex-col gap-6 rounded-3xl p-5 md:p-7"
      style={{ animationDelay: "380ms" }}
    >
      <header className="flex flex-col gap-2">
        <span className="iv-eyebrow text-iv-gold">Simulador</span>
        <h2 id="sim-title" className="font-display text-3xl leading-tight text-iv-ink">
          Simule seu investimento
        </h2>
        <p className="text-sm leading-relaxed text-iv-muted">Digite o valor que deseja investir e veja quanto irá render.</p>
      </header>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <label htmlFor="invest-amount" className="text-sm font-medium text-iv-ink/85">
            Valor do investimento
          </label>
          {authenticated && balance !== undefined && (
            <button
              type="button"
              onClick={() => balance >= INVEST_MIN && setRaw(formatInput(Math.floor(balance * 100) / 100))}
              className="iv-num min-h-11 text-xs text-iv-muted transition-colors hover:text-iv-sky"
            >
              Saldo <span className="text-iv-ink">{fmtUsd(balance)}</span>
            </button>
          )}
        </div>
        <div
          className={cn(
            "iv-inset flex items-center gap-3 rounded-2xl px-4 transition-all focus-within:border-iv-sky/70 focus-within:shadow-[0_0_0_4px_rgb(61_180_255/0.12)]",
            !valid && raw && "border-lp-down/60",
          )}
        >
          <span className="text-sm font-medium text-iv-muted">US$</span>
          <input
            id="invest-amount"
            inputMode="decimal"
            value={raw}
            onChange={(e) => setRaw(e.target.value.replace(/[^\d.,]/g, ""))}
            onBlur={() => Number.isFinite(amount) && amount > 0 && setRaw(formatInput(amount))}
            className="iv-num h-14 min-w-0 flex-1 bg-transparent text-2xl font-semibold text-iv-ink outline-none"
          />
        </div>
        <div className="grid grid-cols-5 gap-1.5 rounded-2xl border border-iv-line/70 bg-iv-bg/50 p-1">
          {PRESETS.map((p) => {
            const active = Math.abs(amount - p) < 0.005
            return (
              <button
                key={p}
                type="button"
                onClick={() => setRaw(formatInput(p))}
                aria-pressed={active}
                aria-label={`US$ ${p.toLocaleString("pt-BR")}`}
                className={cn(
                  "iv-num h-11 rounded-xl text-sm font-medium transition-all active:scale-95",
                  active
                    ? "bg-iv-blue text-iv-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_6px_16px_-6px_rgb(22_114_255/0.8)]"
                    : "text-iv-ink/70 hover:bg-iv-line/50 hover:text-iv-ink",
                )}
              >
                {shortUsd(p)}
              </button>
            )
          })}
        </div>
        {!valid && raw && <p className="text-sm text-lp-down">Valor mínimo: US$ 500</p>}
        {insufficient && <p className="text-sm text-lp-down">Saldo insuficiente para esse valor</p>}
      </div>

      <div className="iv-inset flex flex-col gap-5 rounded-2xl p-5">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-iv-muted">Rendimento mensal (10%)</span>
          <Money value={monthly} className="text-[2.5rem] font-semibold leading-none text-iv-sky" />
        </div>
        <div className="iv-hairline" />
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-sm text-iv-muted">Valor total em 3 meses</span>
            <Money value={total} className="text-xl font-semibold text-iv-ink" />
          </div>
          <div className="flex flex-col items-end gap-1 text-right">
            <span className="flex items-center gap-1.5 text-sm text-iv-muted">
              <CalendarDays className="size-3.5" aria-hidden /> Liberação
            </span>
            <span className="iv-num text-xl font-semibold text-iv-ink">Dia 30</span>
          </div>
        </div>
        <div className="iv-hairline" />
        <Projection amount={valid ? amount : INVEST_MIN} />
      </div>

      {authenticated ? (
        <button
          type="button"
          onClick={confirm}
          disabled={!valid || busy || insufficient}
          className="iv-btn iv-shine group relative flex h-14 items-center justify-center gap-2 overflow-hidden rounded-2xl text-base font-semibold text-iv-ink transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
          Confirmar Investimento
          <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" aria-hidden />
        </button>
      ) : (
        <Link
          href="/auth/login"
          className="iv-btn iv-shine relative flex h-14 items-center justify-center gap-2 overflow-hidden rounded-2xl text-base font-semibold text-iv-ink"
        >
          Entrar para investir <ArrowRight className="size-5" aria-hidden />
        </Link>
      )}
    </section>
    {applying && <InvestApplying amount={applying.amount} startedAt={applying.startedAt} done={applying.done} />}
    </>
  )
}
