"use client"

import { useState } from "react"
import useSWR from "swr"
import { ArrowRightLeft, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { fmtBrl, fmtUsd, usdToBrlClient, useUsdBrlQuote } from "@/components/deposit/pix-conversion"

type SettingsMap = Record<string, unknown>

const fetcher = (url: string) => fetch(url).then((r) => r.json())

const clean = (v: unknown, fallback: string) =>
  v === undefined || v === null || v === "" ? fallback : String(v).replace(/"/g, "")

export function AdminDepositSettings() {
  const { data: settings, mutate } = useSWR<SettingsMap>("/api/admin/settings", fetcher, { revalidateOnFocus: false })
  const { data: quote } = useUsdBrlQuote()

  const [draft, setDraft] = useState<{ min?: string; max?: string; spread?: string }>({})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null)

  const min = draft.min ?? clean(settings?.deposit_min_usd, "100")
  const max = draft.max ?? clean(settings?.deposit_max_usd, "20000")
  const spread = draft.spread ?? clean(settings?.pix_fx_spread_percent, "0")

  const minNum = Number(min.replace(",", "."))
  const spreadNum = Number(spread.replace(",", "."))
  const previewRate =
    quote && Number.isFinite(spreadNum) ? Math.round(quote.market_rate * (1 + spreadNum / 100) * 10000) / 10000 : null

  const save = async () => {
    setSaving(true)
    setMsg(null)
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deposit_min_usd: Number(min.replace(",", ".")),
          deposit_max_usd: Number(max.replace(",", ".")),
          pix_fx_spread_percent: Number(spread.replace(",", ".")),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMsg({ type: "err", text: data.error || "Não foi possível salvar." })
        return
      }
      setDraft({})
      await mutate()
      setMsg({ type: "ok", text: "Configurações de depósito salvas." })
    } catch {
      setMsg({ type: "err", text: "Erro de conexão ao salvar." })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-2xl border border-adm-line bg-adm-surface" aria-labelledby="deposit-settings-title">
      <header className="flex flex-col gap-1 border-b border-adm-line px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 id="deposit-settings-title" className="text-base font-semibold text-adm-fg">
            Depósito PIX em dólar
          </h3>
          <p className="text-sm text-adm-muted">O cliente paga em reais e recebe o saldo em dólar.</p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-adm-line bg-adm-bg px-3 py-1.5">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-adm-up opacity-60" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-adm-up" />
          </span>
          <span className="font-mono text-xs tabular-nums text-adm-fg">
            {quote ? `USD/BRL ${quote.market_rate.toFixed(4)}` : "Carregando cotação..."}
          </span>
        </div>
      </header>

      <div className="grid gap-4 p-6 md:grid-cols-3">
        <Field
          id="deposit-min-usd"
          label="Depósito mínimo"
          prefix="US$"
          value={min}
          onChange={(v) => setDraft((d) => ({ ...d, min: v }))}
          hint={
            quote && Number.isFinite(minNum) && minNum > 0
              ? `Hoje ≈ R$ ${fmtBrl(usdToBrlClient(minNum, previewRate ?? quote.rate))} no PIX`
              : "Valor mínimo creditado no saldo"
          }
        />
        <Field
          id="deposit-max-usd"
          label="Depósito máximo"
          prefix="US$"
          value={max}
          onChange={(v) => setDraft((d) => ({ ...d, max: v }))}
          hint="Limite por depósito PIX"
        />
        <Field
          id="pix-fx-spread"
          label="Spread cambial"
          suffix="%"
          value={spread}
          onChange={(v) => setDraft((d) => ({ ...d, spread: v }))}
          hint="Acréscimo sobre a cotação de mercado (0 = sem spread)"
        />
      </div>

      <div className="mx-6 mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-adm-line bg-adm-bg px-4 py-3">
        <ArrowRightLeft className="h-4 w-4 text-adm-accent" aria-hidden="true" />
        <span className="text-sm text-adm-muted">
          Cotação aplicada ao cliente:{" "}
          <span className="font-mono tabular-nums text-adm-fg">
            {previewRate ? `R$ ${previewRate.toFixed(4)}` : "—"}
          </span>
        </span>
        <span className="text-sm text-adm-muted">
          Exemplo:{" "}
          <span className="font-mono tabular-nums text-adm-fg">
            {previewRate ? `US$ ${fmtUsd(100)} = R$ ${fmtBrl(usdToBrlClient(100, previewRate))}` : "—"}
          </span>
        </span>
      </div>

      <footer className="flex flex-wrap items-center gap-3 border-t border-adm-line px-6 py-4">
        <Button onClick={save} disabled={saving} className="bg-adm-accent text-adm-on-accent hover:bg-adm-accent-strong">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {saving ? "Salvando..." : "Salvar depósito"}
        </Button>
        {msg && (
          <p role="status" className={`text-sm ${msg.type === "ok" ? "text-adm-up" : "text-adm-down"}`}>
            {msg.text}
          </p>
        )}
      </footer>
    </section>
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
  hint: string
  prefix?: string
  suffix?: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wider text-adm-muted">
        {label}
      </label>
      <div className="flex items-center gap-2 rounded-lg border border-adm-line bg-adm-bg px-3 focus-within:border-adm-accent">
        {prefix && <span className="text-sm text-adm-muted">{prefix}</span>}
        <Input
          id={id}
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ""))}
          className="border-0 bg-transparent px-0 font-mono text-base tabular-nums text-adm-fg shadow-none focus-visible:ring-0"
        />
        {suffix && <span className="text-sm text-adm-muted">{suffix}</span>}
      </div>
      <p className="text-xs text-adm-muted">{hint}</p>
    </div>
  )
}
