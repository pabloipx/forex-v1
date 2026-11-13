"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { mutate as globalMutate } from "swr"
import { toast } from "sonner"
import { ArrowRight, Check, Loader2 } from "lucide-react"
import { APPLY_DURATION_MS, InvestApplying } from "./invest-applying"
import { cn } from "@/lib/utils"
import {
  fmtDate,
  fmtRate,
  fmtUsd,
  INVEST_MIN,
  INVEST_MONTHS,
  payoutAt,
  rateFor,
  type InvestRates,
} from "@/lib/invest-schedule"
import { useCountUp } from "./use-count-up"
import {
  getInvestAsset,
  INVEST_ASSET_GROUPS,
  INVEST_ASSETS,
  type InvestAssetGroup,
  type InvestAssetId,
} from "@/lib/invest-assets"

const PRESETS = [500, 1000, 2000, 5000, 10000]

const parseAmount = (raw: string) => Number(raw.replace(/[^\d,]/g, "").replace(",", "."))
const formatInput = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const shortUsd = (v: number) => (v >= 1000 ? `${(v / 1000).toLocaleString("pt-BR")}k` : String(v))

function AssetTiles({
  value,
  onChange,
  rates,
}: {
  value: InvestAssetId
  onChange: (id: InvestAssetId) => void
  rates?: InvestRates
}) {
  const [group, setGroup] = useState<InvestAssetGroup>(getInvestAsset(value).group)
  const assets = INVEST_ASSETS.filter((a) => a.group === group)

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="sr-only">Escolha o ativo</legend>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-iv-ink">Ativo</span>
        <span className="text-xs text-iv-muted">{INVEST_ASSETS.length} ativos disponíveis</span>
      </div>
      <div role="tablist" aria-label="Categorias de ativos" className="flex gap-1 rounded-xl border border-iv-line/70 bg-iv-bg/60 p-1">
        {INVEST_ASSET_GROUPS.map((g) => {
          const active = g.id === group
          return (
            <button
              key={g.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setGroup(g.id)}
              className={cn(
                "h-10 flex-1 rounded-lg text-sm font-medium transition-colors",
                active ? "bg-iv-line text-iv-ink" : "text-iv-muted hover:text-iv-ink",
              )}
            >
              {g.label}
            </button>
          )
        })}
      </div>
      <div role="radiogroup" aria-label="Ativos" className="grid grid-cols-2 gap-2">
        {assets.map((a, i) => {
          const selected = a.id === value
          return (
            <button
              key={a.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(a.id)}
              className={cn(
                "iv-rise relative flex min-h-[72px] items-center gap-3 rounded-xl border p-3 text-left transition-all active:scale-[0.98]",
                selected
                  ? "border-iv-sky/70 bg-iv-blue/15 shadow-[0_0_0_3px_rgb(61_180_255/0.12),0_10px_30px_-12px_rgb(22_114_255/0.6)]"
                  : "border-iv-line/70 bg-iv-bg/40 hover:border-iv-line hover:bg-iv-line/20",
              )}
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <span className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full ring-1 ring-iv-line">
                <img src={a.logo} alt="" width={40} height={40} decoding="async" className="size-full object-cover" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="iv-num text-sm font-bold text-iv-ink">{a.badge ?? a.ticker}</span>
                <span className="line-clamp-2 text-xs leading-snug text-iv-muted">{a.name}</span>
                <span className="iv-num mt-0.5 text-xs font-semibold text-iv-up">{fmtRate(rateFor(rates, a.id))} a.m.</span>
              </span>
              {selected && (
                <span className="iv-pop absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-iv-sky text-iv-bg">
                  <Check className="size-3" strokeWidth={3.5} aria-hidden />
                </span>
              )}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

function ProjectionBars({ amount, rate }: { amount: number; rate: number }) {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(id)
  }, [])
  const monthly = amount * rate
  const final = amount + monthly * INVEST_MONTHS
  return (
    <div className="flex h-24 items-end gap-2" aria-hidden>
      {Array.from({ length: INVEST_MONTHS + 1 }, (_, i) => {
        const value = amount + monthly * i
        const pct = 45 + (55 * (value - amount)) / Math.max(final - amount, 1)
        return (
          <div key={i} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
            <div
              className={cn(
                "w-full rounded-t-md transition-[height] duration-700 ease-out",
                i === 0 ? "bg-iv-line" : "bg-gradient-to-t from-[#0e8f5c] to-[#16d98a]",
              )}
              style={{ height: shown ? `${pct}%` : "6%", transitionDelay: `${i * 90}ms` }}
            />
            <span className="text-[10px] text-iv-muted">{i === 0 ? "Hoje" : `Mês ${i}`}</span>
          </div>
        )
      })}
    </div>
  )
}

export function InvestSimulator({
  authenticated,
  balance,
  rates,
  onInvested,
}: {
  authenticated: boolean
  balance?: number
  rates?: InvestRates
  onInvested?: () => void
}) {
  const [raw, setRaw] = useState(formatInput(1000))
  const [asset, setAsset] = useState<InvestAssetId>("USD")
  const [busy, setBusy] = useState(false)
  const [applying, setApplying] = useState<{ amount: number; rate: number; startedAt: number; done: boolean } | null>(null)
  const [today] = useState(() => new Date())
  const rate = rateFor(rates, asset)
  const amount = parseAmount(raw)
  const valid = Number.isFinite(amount) && amount >= INVEST_MIN
  const safe = valid ? amount : 0
  const monthly = useCountUp(safe * rate, 500)
  const total = useCountUp(safe * (1 + rate * INVEST_MONTHS), 500)
  const insufficient = authenticated && balance !== undefined && valid && amount > balance
  const selected = getInvestAsset(asset)

  const confirm = async () => {
    if (!valid || busy || insufficient) return
    const value = Math.round(amount * 100) / 100
    setBusy(true)
    setApplying({ amount: value, rate, startedAt: Date.now(), done: false })
    const minDelay = new Promise((r) => setTimeout(r, APPLY_DURATION_MS))
    let ok = false
    try {
      const res = await fetch("/api/invest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: value, asset }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Não foi possível investir")
      await minDelay
      const contracted = Number(json.result.monthly_rate)
      setApplying((a) => (a ? { ...a, done: true, rate: contracted > 0 ? contracted : a.rate } : a))
      await Promise.all([globalMutate("/api/invest"), globalMutate("/api/futures/state?account=real")])
      await new Promise((r) => setTimeout(r, 1800))
      toast.success(`Investimento de ${fmtUsd(json.result.amount)} em ${selected.name} aplicado`)
      ok = true
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setApplying(null)
      setBusy(false)
    }
    if (ok) onInvested?.()
  }

  return (
    <>
      <div className="grid min-h-0 flex-1 gap-6 overflow-y-auto overscroll-contain px-5 pb-5 sm:px-6 md:grid-cols-2">
        <AssetTiles value={asset} onChange={setAsset} rates={rates} />

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <label htmlFor="invest-amount" className="text-sm font-semibold text-iv-ink">
                Valor do aporte
              </label>
              {authenticated && balance !== undefined && balance >= INVEST_MIN && (
                <button
                  type="button"
                  onClick={() => setRaw(formatInput(Math.floor(balance * 100) / 100))}
                  className="text-xs font-semibold text-iv-sky transition-colors hover:text-iv-ink"
                >
                  Usar saldo total
                </button>
              )}
            </div>
            <div
              className={cn(
                "flex items-center gap-2 rounded-xl border bg-iv-bg/70 px-4 transition-all focus-within:border-iv-sky/70 focus-within:shadow-[0_0_0_4px_rgb(61_180_255/0.12)]",
                (!valid && raw) || insufficient ? "border-lp-down/60" : "border-iv-line/80",
              )}
            >
              <span className="text-base font-medium text-iv-muted">US$</span>
              <input
                id="invest-amount"
                inputMode="decimal"
                autoComplete="off"
                value={raw}
                onChange={(e) => setRaw(e.target.value.replace(/[^\d.,]/g, ""))}
                onBlur={() => Number.isFinite(amount) && amount > 0 && setRaw(formatInput(amount))}
                aria-invalid={(!valid && Boolean(raw)) || insufficient}
                aria-describedby="invest-amount-hint"
                className="iv-num h-14 min-w-0 flex-1 bg-transparent text-[1.75rem] font-bold text-iv-ink outline-none"
              />
            </div>
            <div className="grid grid-cols-5 gap-1.5">
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
                      "iv-num h-10 rounded-lg border text-sm font-semibold transition-all active:scale-95",
                      active
                        ? "border-iv-sky/70 bg-iv-blue/20 text-iv-ink"
                        : "border-iv-line/70 text-iv-ink/70 hover:border-iv-line hover:text-iv-ink",
                    )}
                  >
                    {shortUsd(p)}
                  </button>
                )
              })}
            </div>
            <p id="invest-amount-hint" className={cn("text-xs", (!valid && raw) || insufficient ? "text-lp-down" : "text-iv-muted")}>
              {insufficient ? "Saldo insuficiente para esse valor." : !valid && raw ? "Valor mínimo: US$ 500,00." : "Mínimo de US$ 500,00."}
            </p>
          </div>

          <div className="flex flex-col gap-4 rounded-xl border border-iv-line/70 bg-iv-bg/50 p-4">
            <div className="flex items-end justify-between gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-iv-muted">Rendimento mensal</span>
                <span className="iv-num text-3xl font-bold leading-none text-iv-up">+{fmtUsd(monthly)}</span>
              </div>
              <span className="rounded-md border border-iv-up/25 bg-iv-up/10 px-2 py-1 text-xs font-semibold text-iv-up">
                {fmtRate(rate)} a.m.
              </span>
            </div>
            <ProjectionBars amount={valid ? amount : INVEST_MIN} rate={rate} />
            <dl className="flex flex-col divide-y divide-iv-line/60 text-sm">
              <div className="flex items-center justify-between gap-3 py-2">
                <dt className="text-iv-muted">Ativo</dt>
                <dd className="flex items-center gap-2 font-medium text-iv-ink">
                  <img src={selected.logo} alt="" width={18} height={18} className="size-[18px] rounded-full object-cover" />
                  {selected.name}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-2">
                <dt className="text-iv-muted">Primeiro rendimento</dt>
                <dd className="iv-num font-medium text-iv-ink">{fmtDate(payoutAt(today, 1).toISOString())}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 py-2">
                <dt className="text-iv-muted">Resgate do valor</dt>
                <dd className="iv-num font-medium text-iv-ink">{fmtDate(payoutAt(today, INVEST_MONTHS).toISOString())}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 pt-2">
                <dt className="font-semibold text-iv-ink">Total em {INVEST_MONTHS} meses</dt>
                <dd className="iv-num text-base font-bold text-iv-ink">{fmtUsd(total)}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      <div className="border-t border-iv-line/70 bg-iv-card/95 px-5 py-4 sm:px-6">
        {authenticated ? (
          <button
            type="button"
            onClick={confirm}
            disabled={!valid || busy || insufficient}
            className="iv-btn iv-shine group relative flex h-14 w-full items-center justify-center gap-2 overflow-hidden rounded-xl text-base font-semibold text-iv-ink transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-50"
          >
            {busy && <Loader2 className="size-5 animate-spin" aria-hidden />}
            {valid ? `Aportar ${fmtUsd(amount)}` : "Aportar"}
            <ArrowRight className="size-5 transition-transform group-hover:translate-x-1" aria-hidden />
          </button>
        ) : (
          <Link
            href="/auth/login?next=/invest"
            className="iv-btn flex h-14 w-full items-center justify-center gap-2 rounded-xl text-base font-semibold text-iv-ink"
          >
            Entrar para investir <ArrowRight className="size-5" aria-hidden />
          </Link>
        )}
      </div>

      {applying && (
        <InvestApplying amount={applying.amount} rate={applying.rate} startedAt={applying.startedAt} done={applying.done} />
      )}
    </>
  )
}
