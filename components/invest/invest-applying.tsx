"use client"

import { useEffect, useState } from "react"
import { Check, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { fmtUsd } from "@/lib/invest-schedule"

export const APPLY_DURATION_MS = 15000

const STEPS = [
  "Validando seu saldo",
  "Reservando o valor na sua conta",
  "Aplicando o investimento",
  "Agendando os rendimentos mensais",
  "Confirmando a aplicação",
]

const RING = 2 * Math.PI * 52

export function InvestApplying({ amount, startedAt, done }: { amount: number; startedAt: number; done: boolean }) {
  const [now, setNow] = useState(startedAt)

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(id)
  }, [])

  const progress = done ? 1 : Math.min((now - startedAt) / APPLY_DURATION_MS, 0.99)
  const active = done ? STEPS.length : Math.min(Math.floor(progress * STEPS.length), STEPS.length - 1)
  const remaining = Math.max(0, Math.ceil((APPLY_DURATION_MS - (now - startedAt)) / 1000))

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="applying-title"
      className="iv-fade fixed inset-0 z-50 flex items-center justify-center bg-iv-bg/85 p-5 backdrop-blur-md"
    >
      <div className="iv-panel iv-pop flex w-full max-w-sm flex-col items-center gap-6 rounded-3xl p-6">
        <div className="relative flex size-36 items-center justify-center">
          <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90" aria-hidden>
            <circle cx="60" cy="60" r="52" fill="none" strokeWidth="6" className="stroke-iv-line" />
            <circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={RING}
              strokeDashoffset={RING * (1 - progress)}
              className={cn("transition-[stroke-dashoffset] duration-100 ease-linear", done ? "stroke-lp-up" : "stroke-iv-sky")}
            />
          </svg>
          {!done && <span className="iv-halo absolute inset-3 rounded-full" aria-hidden />}
          {done ? (
            <span className="iv-pop flex size-16 items-center justify-center rounded-full bg-lp-up/15 text-lp-up">
              <Check className="size-8" aria-hidden />
            </span>
          ) : (
            <div className="flex flex-col items-center">
              <span className="iv-num text-3xl font-semibold text-iv-ink">{Math.round(progress * 100)}%</span>
              <span className="iv-num text-xs text-iv-muted">{remaining}s</span>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-1.5 text-center">
          <h2 id="applying-title" className="font-display text-2xl text-iv-ink text-balance">
            {done ? "Investimento aplicado" : "Aplicando seu investimento"}
          </h2>
          <p className="text-sm leading-relaxed text-iv-muted">
            <span className="iv-num font-semibold text-iv-ink">{fmtUsd(amount)}</span>
            {done ? " já está rendendo 10% ao mês." : " · não feche esta tela"}
          </p>
        </div>

        <ol className="flex w-full flex-col gap-2.5" aria-live="polite">
          {STEPS.map((label, i) => {
            const state = i < active ? "done" : i === active ? "active" : "todo"
            return (
              <li
                key={label}
                className={cn(
                  "flex items-center gap-3 text-sm transition-colors duration-500",
                  state === "done" && "text-iv-ink",
                  state === "active" && "text-iv-sky",
                  state === "todo" && "text-iv-muted/60",
                )}
              >
                <span
                  className={cn(
                    "flex size-6 flex-none items-center justify-center rounded-full border transition-all duration-500",
                    state === "done" && "border-lp-up/50 bg-lp-up/15 text-lp-up",
                    state === "active" && "border-iv-sky/60 bg-iv-sky/10",
                    state === "todo" && "border-iv-line",
                  )}
                  aria-hidden
                >
                  {state === "done" ? (
                    <Check className="size-3.5" />
                  ) : state === "active" ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : null}
                </span>
                {label}
              </li>
            )
          })}
        </ol>
      </div>
    </div>
  )
}
