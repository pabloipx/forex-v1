"use client"

import { useState } from "react"
import { toast } from "sonner"
import { mutate } from "swr"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import type { ClientTradingPrefs } from "@/hooks/use-futures"

const LEVERAGES = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500]

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded border border-term-line p-0.5">
      {options.map(([v, l]) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={cn(
            "rounded px-3 py-1.5 text-sm",
            value === v ? "bg-term-line font-semibold text-term-text" : "text-term-muted hover:text-term-text",
          )}
        >
          {l}
        </button>
      ))}
    </div>
  )
}

function Row({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b border-term-line py-4 last:border-0 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-sm text-term-muted text-pretty">{desc}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

export function PreferencesTab({
  prefs,
  onSave,
}: {
  prefs: ClientTradingPrefs
  onSave: (p: { preferences: Partial<ClientTradingPrefs> }) => Promise<unknown>
}) {
  const [saving, setSaving] = useState(false)

  const update = async (patch: Partial<ClientTradingPrefs>) => {
    setSaving(true)
    try {
      await onSave({ preferences: patch })
      await mutate("/api/futures/profile")
      toast.success("Preferência salva")
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section aria-busy={saving} className="flex flex-col rounded-md border border-term-line bg-term-panel p-4 md:p-6">
      <div className="flex flex-col gap-1 pb-2">
        <h2 className="text-base font-semibold">Preferências de trading</h2>
        <p className="text-sm text-term-muted">Aplicadas automaticamente no terminal de futuros ao abrir um mercado.</p>
      </div>
      <Row title="Conta padrão" desc="Conta selecionada ao abrir o terminal.">
        <Segmented
          label="Conta padrão"
          value={prefs.defaultAccount}
          options={[
            ["real", "Real"],
            ["demo", "Demo"],
          ]}
          onChange={(v) => update({ defaultAccount: v })}
        />
      </Row>
      <Row title="Modo de margem padrão" desc="Cruzada compartilha o saldo entre posições; isolada limita a perda à margem da posição.">
        <Segmented
          label="Modo de margem"
          value={prefs.defaultMarginMode}
          options={[
            ["cross", "Cruzada"],
            ["isolated", "Isolada"],
          ]}
          onChange={(v) => update({ defaultMarginMode: v })}
        />
      </Row>
      <Row title="Alavancagem padrão" desc="Limitada automaticamente ao máximo permitido em cada mercado.">
        <select
          aria-label="Alavancagem padrão"
          value={prefs.defaultLeverage}
          onChange={(e) => update({ defaultLeverage: Number(e.target.value) })}
          className="h-9 rounded border border-term-line bg-term-bg px-3 font-mono text-sm text-term-text outline-none focus:border-primary"
        >
          {LEVERAGES.map((l) => (
            <option key={l} value={l}>
              {l}x
            </option>
          ))}
        </select>
      </Row>
      <Row title="Confirmar antes de enviar ordens" desc="Exibe uma confirmação com lado, quantidade, preço e alavancagem.">
        <Switch
          aria-label="Confirmar ordens"
          checked={prefs.confirmOrders}
          onCheckedChange={(v) => update({ confirmOrders: v })}
        />
      </Row>
    </section>
  )
}
