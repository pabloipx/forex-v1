"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { TrendingDown, TrendingUp, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge, ErrorNote, inputCls } from "./ui"
import { adminAction, refreshAdmin, useAdminView, usd } from "./use-admin"

interface LaunchRow {
  id: string
  symbol: string
  name: string
  icon_url: string | null
  initial_price_usd: number | null
  price_usd: number | null
  status: "upcoming" | "live" | "ended"
  phase: "presale" | "live" | "ended"
  holders: { holders: number; qty: number; invested_usd: number } | null
}

const MOVE_PRESETS = [1, 2, 5, 10, 25, 50]
const PHASE_LABEL = { presale: "Pré-venda", live: "Ao vivo", ended: "Encerrada" } as const
const PHASE_TONE = { presale: "accent", live: "up", ended: "muted" } as const

const decimalsFor = (p: number) => (p > 0 && p < 1 ? 6 : 2)
const roundPrice = (p: number) => {
  const f = 10 ** decimalsFor(p)
  return Math.round(p * f) / f
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-term-muted">{label}</span>
      {children}
    </div>
  )
}

function CoinIcon({ launch }: { launch: LaunchRow }) {
  if (launch.icon_url) {
    return <img src={launch.icon_url} alt="" className="size-10 flex-none rounded-full border border-term-line object-cover" />
  }
  return (
    <span aria-hidden className="flex size-10 flex-none items-center justify-center rounded-full border border-term-line bg-term-bg font-mono text-xs font-semibold text-term-text">
      {launch.symbol.slice(0, 3)}
    </span>
  )
}

export function LaunchManipulation() {
  const { data, error } = useAdminView<LaunchRow[]>("launches", 5000)
  const launches = (data ?? []).filter((l) => l.status !== "ended")

  const [launchId, setLaunchId] = useState<string>("")
  const [direction, setDirection] = useState<"up" | "down">("up")
  const [movePct, setMovePct] = useState("5")
  const [targetDraft, setTargetDraft] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!launchId && launches[0]) setLaunchId(launches[0].id)
  }, [launchId, launches])

  const launch = launches.find((l) => l.id === launchId) ?? null
  const price = launch ? (launch.price_usd ?? launch.initial_price_usd ?? 0) : 0
  const dec = decimalsFor(price)
  const pct = Number(movePct.replace(",", "."))
  const target = price > 0 && pct > 0 ? roundPrice(price * (1 + (direction === "up" ? 1 : -1) * (pct / 100))) : null
  const holdersQty = launch?.holders?.qty ?? 0
  const holdersCount = launch?.holders?.holders ?? 0

  const applyTarget = (raw: string) => {
    setTargetDraft(raw)
    const v = Number(raw.replace(",", "."))
    if (!(price > 0) || !(v > 0)) return
    const diff = (v / price - 1) * 100
    if (Math.abs(diff) < 0.0001) return
    setDirection(diff > 0 ? "up" : "down")
    setMovePct(String(Number(Math.abs(diff).toFixed(3))))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!launch || target == null) return toast.error("Escolha a moeda e o tamanho do movimento")
    if (direction === "down" && pct >= 100) return toast.error("A queda precisa ser menor que 100%")
    if (pct > 1000) return toast.error("Movimento máximo: 1000%")
    setBusy(true)
    try {
      await adminAction({ action: "set_launch_price", id: launch.id, price: target })
      await refreshAdmin("launches", "investors_crypto")
      setTargetDraft(null)
      toast.success(`${launch.symbol}: US$ ${usd(price, dec)} → US$ ${usd(target, decimalsFor(target))}`)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (error) return <ErrorNote error={error} />
  if (data && launches.length === 0) {
    return <p className="px-4 py-10 text-center text-xs text-term-muted">Nenhuma moeda em lançamento cadastrada.</p>
  }
  if (!launch) return <p className="px-4 py-10 text-center text-xs text-term-muted">Carregando moedas...</p>

  return (
    <form onSubmit={submit} className="flex flex-col gap-5 px-4 pb-4">
      <Field label="Moeda">
        <select value={launch.id} onChange={(e) => setLaunchId(e.target.value)} className={inputCls} aria-label="Moeda em lançamento">
          {launches.map((l) => (
            <option key={l.id} value={l.id}>
              {l.symbol} — {l.name}
            </option>
          ))}
        </select>
        <div className="flex items-center gap-3 rounded-md border border-term-line bg-term-bg px-3 py-2.5">
          <CoinIcon launch={launch} />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-semibold text-term-text">{launch.name}</span>
            <span className="font-mono text-xs text-term-muted">{launch.symbol}</span>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="font-mono text-sm tabular-nums text-term-text">US$ {usd(price, dec)}</span>
            <Badge tone={PHASE_TONE[launch.phase]}>{PHASE_LABEL[launch.phase]}</Badge>
          </div>
        </div>
      </Field>

      <Field label="Direção">
        <div className="grid grid-cols-2 gap-2">
          {(["up", "down"] as const).map((d) => {
            const active = direction === d
            const Icon = d === "up" ? TrendingUp : TrendingDown
            return (
              <button
                key={d}
                type="button"
                aria-pressed={active}
                onClick={() => setDirection(d)}
                className={cn(
                  "flex h-11 items-center justify-center gap-1.5 rounded-md border text-sm font-medium transition-colors",
                  active
                    ? d === "up"
                      ? "border-long bg-long/10 text-long"
                      : "border-short bg-short/10 text-short"
                    : "border-term-line text-term-muted hover:text-term-text",
                )}
              >
                <Icon className="h-4 w-4" aria-hidden /> {d === "up" ? "Alta" : "Baixa"}
              </button>
            )
          })}
        </div>
      </Field>

      <Field label="Tamanho do movimento (%)">
        <div className="grid grid-cols-6 gap-1">
          {MOVE_PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                setMovePct(String(p))
                setTargetDraft(null)
              }}
              className={cn(
                "h-10 rounded border font-mono text-xs",
                pct === p ? "border-primary text-primary" : "border-term-line text-term-muted hover:text-term-text",
              )}
            >
              {p}
            </button>
          ))}
        </div>
        <input
          type="number"
          inputMode="decimal"
          min={0.01}
          step={0.01}
          value={movePct}
          onChange={(e) => {
            setMovePct(e.target.value)
            setTargetDraft(null)
          }}
          className={cn(inputCls, "text-base")}
          aria-label="Movimento em porcentagem"
        />
        <label className="flex items-center justify-between gap-3 rounded-md border border-term-line bg-term-bg px-3 py-1 text-xs focus-within:border-primary">
          <span className="shrink-0 text-term-muted">Novo preço (US$)</span>
          <input
            inputMode="decimal"
            value={targetDraft ?? (target == null ? "" : target.toFixed(decimalsFor(target)))}
            onChange={(e) => applyTarget(e.target.value)}
            onBlur={() => setTargetDraft(null)}
            placeholder="—"
            aria-label="Novo preço"
            className={cn(
              "h-9 w-full min-w-0 bg-transparent text-right font-mono text-base tabular-nums outline-none",
              direction === "up" ? "text-long" : "text-short",
            )}
          />
        </label>
        <span className="text-[11px] leading-relaxed text-term-muted">Digite a % ou o novo preço direto — um calcula o outro.</span>
      </Field>

      {target != null && (
        <div className="flex flex-col gap-2 rounded-md border border-term-line bg-term-bg px-3 py-2.5 text-xs leading-relaxed text-term-muted">
          <p>
            <span className="font-mono text-term-text">{launch.symbol}</span> vai {direction === "up" ? "subir" : "cair"} de{" "}
            <span className="font-mono text-term-text">US$ {usd(price, dec)}</span> para{" "}
            <span className={cn("font-mono", direction === "up" ? "text-long" : "text-short")}>
              US$ {usd(target, decimalsFor(target))}
            </span>{" "}
            na hora. O novo preço fica registrado no gráfico da moeda.
          </p>
          {holdersCount > 0 && (
            <p className="flex items-start gap-1.5">
              <Users className="mt-0.5 h-3.5 w-3.5 flex-none" aria-hidden />
              <span>
                {holdersCount} {holdersCount === 1 ? "cliente tem" : "clientes têm"} essa moeda: o valor total passa de{" "}
                <span className="font-mono text-term-text">US$ {usd(holdersQty * price)}</span> para{" "}
                <span className={cn("font-mono", direction === "up" ? "text-long" : "text-short")}>
                  US$ {usd(holdersQty * target)}
                </span>
                .
              </span>
            </p>
          )}
          {launch.phase === "presale" && (
            <p className="text-primary">Moeda em pré-venda: o novo preço passa a valer no lançamento.</p>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={busy || target == null}
        className="h-11 rounded-md bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {busy ? "Aplicando..." : "Aplicar novo preço"}
      </button>
    </form>
  )
}
