"use client"

import { useState } from "react"
import Link from "next/link"
import { mutate as globalMutate } from "swr"
import { toast } from "sonner"
import { ArrowRight, CalendarDays, Coins, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { fmtUsd, INVEST_MIN, INVEST_MONTHLY_RATE, INVEST_MONTHS } from "@/lib/invest-schedule"
import { useCountUp } from "./use-count-up"

const PRESETS = [500, 1000, 2000, 5000, 10000]

const parseAmount = (raw: string) => Number(raw.replace(/[^\d,]/g, "").replace(",", "."))
const formatInput = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function InvestSimulator({ authenticated, balance }: { authenticated: boolean; balance?: number }) {
  const [raw, setRaw] = useState(formatInput(500))
  const [busy, setBusy] = useState(false)
  const amount = parseAmount(raw)
  const valid = Number.isFinite(amount) && amount >= INVEST_MIN
  const safe = Number.isFinite(amount) ? amount : 0
  const monthly = useCountUp(safe * INVEST_MONTHLY_RATE)
  const total = useCountUp(safe * (1 + INVEST_MONTHLY_RATE * INVEST_MONTHS))

  const confirm = async () => {
    if (!valid || busy) return
    setBusy(true)
    try {
      const res = await fetch("/api/invest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Math.round(amount * 100) / 100 }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Não foi possível investir")
      toast.success(`Investimento de ${fmtUsd(json.result.amount)} confirmado`)
      await Promise.all([globalMutate("/api/invest"), globalMutate("/api/futures/state?account=real")])
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      aria-labelledby="sim-title"
      className="iv-rise flex flex-col gap-5 rounded-2xl border border-iv-line bg-iv-card/80 p-5"
      style={{ animationDelay: "380ms" }}
    >
      <div className="flex items-start gap-3">
        <Coins className="size-9 shrink-0 text-iv-sky" aria-hidden />
        <div className="flex flex-col gap-1">
          <h2 id="sim-title" className="text-xl font-semibold text-iv-ink">
            Simule seu investimento
          </h2>
          <p className="text-sm leading-relaxed text-iv-muted">Digite o valor que deseja investir e veja quanto irá render.</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="invest-amount" className="text-sm text-iv-muted">
          Valor do investimento
        </label>
        <div className="flex items-center gap-2 rounded-xl border border-iv-line bg-iv-bg px-4 transition-colors focus-within:border-iv-blue">
          <span className="text-base text-iv-muted">US$</span>
          <input
            id="invest-amount"
            inputMode="decimal"
            value={raw}
            onChange={(e) => setRaw(e.target.value.replace(/[^\d.,]/g, ""))}
            onBlur={() => Number.isFinite(amount) && amount > 0 && setRaw(formatInput(amount))}
            className="h-12 min-w-0 flex-1 bg-transparent font-mono text-base tabular-nums text-iv-ink outline-none"
          />
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {PRESETS.map((p) => {
            const active = Math.abs(amount - p) < 0.005
            return (
              <button
                key={p}
                type="button"
                onClick={() => setRaw(formatInput(p))}
                aria-pressed={active}
                className={cn(
                  "h-11 rounded-lg border text-sm transition-all active:scale-95",
                  active
                    ? "border-iv-blue bg-iv-blue/20 text-iv-sky"
                    : "border-iv-line bg-iv-bg text-iv-ink/80 hover:border-iv-blue/60",
                )}
              >
                US$ {p.toLocaleString("pt-BR")}
              </button>
            )
          })}
        </div>
        {!valid && raw && <p className="text-sm text-lp-down">Valor mínimo: US$ 500</p>}
        {authenticated && balance !== undefined && (
          <p className="text-sm text-iv-muted">
            Saldo disponível: <span className="font-mono tabular-nums text-iv-ink">{fmtUsd(balance)}</span>
          </p>
        )}
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-iv-line bg-iv-bg/70 p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div aria-hidden className="flex h-9 items-end gap-1">
              {[0.45, 0.7, 1].map((h, i) => (
                <span
                  key={h}
                  className="iv-bar w-2 rounded-sm bg-iv-sky"
                  style={{ height: `${h * 100}%`, animationDelay: `${i * 200}ms` }}
                />
              ))}
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-sm text-iv-ink/85">Rendimento mensal (10%)</span>
              <span className="font-mono text-3xl font-bold tabular-nums text-iv-sky">{fmtUsd(monthly)}</span>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm text-iv-muted">Valor total em 3 meses (bloqueado)</span>
            <span className="font-mono text-lg font-semibold tabular-nums text-iv-ink">{fmtUsd(total)}</span>
          </div>
        </div>
        <div className="flex items-start gap-3 border-t border-iv-line pt-4">
          <CalendarDays className="size-6 shrink-0 text-iv-ink/80" aria-hidden />
          <div className="flex flex-col gap-0.5 text-sm">
            <span className="text-iv-ink/85">Rendimento liberado todo dia 30</span>
            <span className="text-iv-sky">
              Você pode sacar o rendimento mensal <span className="underline underline-offset-2">(todo dia 30)</span>
            </span>
          </div>
        </div>
      </div>

      {authenticated ? (
        <button
          type="button"
          onClick={confirm}
          disabled={!valid || busy}
          className="iv-glow group flex h-12 items-center justify-center gap-2 rounded-xl bg-iv-blue font-medium text-iv-ink transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-5 animate-spin" aria-hidden /> : null}
          Confirmar Investimento
          <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" aria-hidden />
        </button>
      ) : (
        <Link
          href="/auth/login"
          className="iv-glow flex h-12 items-center justify-center gap-2 rounded-xl bg-iv-blue font-medium text-iv-ink"
        >
          Entrar para investir <ArrowRight className="size-5" aria-hidden />
        </Link>
      )}
    </section>
  )
}
