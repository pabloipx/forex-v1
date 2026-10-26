"use client"

import { useState } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import { ArrowDownToLine, ArrowUpFromLine, Loader2 } from "lucide-react"
import { fmtBrl, usdToBrlClient, useUsdBrlQuote } from "@/components/deposit/pix-conversion"
import { cn } from "@/lib/utils"
import { ErrorNote, Panel } from "./ui"

type Settings = Record<string, string>
type FieldKey = "deposit_min_usd" | "deposit_max_usd" | "pix_fx_spread_percent" | "withdraw_min_usd" | "withdrawal_processing_hours"

const DEFAULTS: Record<FieldKey, string> = {
  deposit_min_usd: "100",
  deposit_max_usd: "20000",
  pix_fx_spread_percent: "0",
  withdraw_min_usd: "100",
  withdrawal_processing_hours: "72",
}

const fetcher = async (url: string): Promise<Settings> => {
  const res = await fetch(url, { cache: "no-store" })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? "Erro ao carregar configurações")
  return json
}

const clean = (v: unknown, fallback: string) => (v == null || v === "" ? fallback : String(v).replace(/"/g, ""))
const toNum = (v: string) => Number(v.replace(",", "."))

export function LimitsSection() {
  const { data, error, mutate } = useSWR("/api/admin/settings", fetcher, { revalidateOnFocus: false })
  const { data: quote } = useUsdBrlQuote()
  const [draft, setDraft] = useState<Partial<Record<FieldKey, string>>>({})
  const [saving, setSaving] = useState<"deposit" | "withdraw" | null>(null)

  const val = (k: FieldKey) => draft[k] ?? clean(data?.[k], DEFAULTS[k])
  const set = (k: FieldKey) => (v: string) => setDraft((d) => ({ ...d, [k]: v }))
  const rate = quote?.market_rate ?? null
  const brlHint = (usd: number) => (rate && usd > 0 ? `≈ R$ ${fmtBrl(usdToBrlClient(usd, rate))} na cotação atual` : undefined)

  const save = async (group: "deposit" | "withdraw", keys: FieldKey[]) => {
    const body = Object.fromEntries(keys.map((k) => [k, toNum(val(k))]))
    if (Object.values(body).some((n) => !Number.isFinite(n))) {
      toast.error("Preencha os valores com números válidos")
      return
    }
    setSaving(group)
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? "Não foi possível salvar")
      setDraft((d) => {
        const next = { ...d }
        for (const k of keys) delete next[k]
        return next
      })
      await mutate()
      toast.success(group === "deposit" ? "Limites de depósito salvos" : "Limites de saque salvos")
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(null)
    }
  }

  const depMin = toNum(val("deposit_min_usd"))
  const wdMin = toNum(val("withdraw_min_usd"))

  return (
    <div className="flex flex-col gap-4">
      <ErrorNote error={error} />
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel
          title="Depósito"
          action={<GroupIcon icon={ArrowDownToLine} tone="up" />}
        >
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <Field id="dep-min" label="Mínimo" prefix="US$" value={val("deposit_min_usd")} onChange={set("deposit_min_usd")} hint={brlHint(depMin)} />
            <Field id="dep-max" label="Máximo" prefix="US$" value={val("deposit_max_usd")} onChange={set("deposit_max_usd")} hint="Por depósito" />
            <Field
              id="dep-spread"
              label="Spread cambial PIX"
              suffix="%"
              value={val("pix_fx_spread_percent")}
              onChange={set("pix_fx_spread_percent")}
              hint="Acréscimo sobre a cotação (0 = sem spread)"
            />
          </div>
          <Footer
            busy={saving === "deposit"}
            disabled={!data}
            onSave={() => save("deposit", ["deposit_min_usd", "deposit_max_usd", "pix_fx_spread_percent"])}
          />
        </Panel>

        <Panel title="Saque" action={<GroupIcon icon={ArrowUpFromLine} tone="down" />}>
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <Field id="wd-min" label="Mínimo" prefix="US$" value={val("withdraw_min_usd")} onChange={set("withdraw_min_usd")} hint={brlHint(wdMin)} />
            <Field
              id="wd-hours"
              label="Prazo exibido ao cliente"
              suffix="horas"
              value={val("withdrawal_processing_hours")}
              onChange={set("withdrawal_processing_hours")}
              hint="Somente informativo na tela de saque"
            />
          </div>
          <Footer
            busy={saving === "withdraw"}
            disabled={!data}
            onSave={() => save("withdraw", ["withdraw_min_usd", "withdrawal_processing_hours"])}
          />
        </Panel>
      </div>
      <p className="px-1 text-xs leading-relaxed text-term-muted">
        {`Os limites valem na hora para novos pedidos e são validados também no servidor. Cotação de referência: ${
          rate ? `1 USD = R$ ${rate.toFixed(4)}` : "carregando..."
        }`}
      </p>
    </div>
  )
}

function GroupIcon({ icon: Icon, tone }: { icon: typeof ArrowDownToLine; tone: "up" | "down" }) {
  return (
    <span className={cn("flex size-7 items-center justify-center rounded-md", tone === "up" ? "bg-long/15 text-long" : "bg-short/15 text-short")}>
      <Icon className="size-4" aria-hidden="true" />
    </span>
  )
}

function Footer({ busy, disabled, onSave }: { busy: boolean; disabled: boolean; onSave: () => void }) {
  return (
    <div className="flex justify-end border-t border-term-line px-4 py-3">
      <button
        type="button"
        onClick={onSave}
        disabled={busy || disabled}
        className="flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {busy ? "Salvando..." : "Salvar"}
      </button>
    </div>
  )
}

function Field({
  id,
  label,
  value,
  onChange,
  hint,
  prefix,
  suffix,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  hint?: string
  prefix?: string
  suffix?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-term-muted">
        {label}
      </label>
      <div className="flex h-11 items-center gap-2 rounded-lg border border-term-line bg-term-bg px-3 transition-colors focus-within:border-primary">
        {prefix && <span className="text-sm text-term-muted">{prefix}</span>}
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ""))}
          className="w-full min-w-0 bg-transparent font-mono text-base font-semibold tabular-nums text-term-text outline-none"
        />
        {suffix && <span className="text-sm text-term-muted">{suffix}</span>}
      </div>
      {hint && <p className="text-xs text-term-muted">{hint}</p>}
    </div>
  )
}
