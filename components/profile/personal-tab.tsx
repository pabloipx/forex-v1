"use client"

import { useState, type FormEvent } from "react"
import { toast } from "sonner"
import type { ProfileData } from "./use-profile"
import { REQUIRED_FIELDS, profileCompletion } from "@/lib/profile-completeness"

const REQUIRED = new Set<string>(REQUIRED_FIELDS.map((f) => f.key))

type FieldKey =
  | "full_name"
  | "nickname"
  | "phone"
  | "document_number"
  | "birth_date"
  | "country"
  | "address_line"
  | "city"
  | "state"
  | "postal_code"
  | "occupation"

const FIELDS: { key: FieldKey; label: string; type?: string; max?: number; span?: boolean; auto?: string }[] = [
  { key: "full_name", label: "Nome completo", max: 120, span: true, auto: "name" },
  { key: "nickname", label: "Apelido (exibido no app)", max: 40, auto: "nickname" },
  { key: "phone", label: "Telefone", type: "tel", max: 30, auto: "tel" },
  { key: "document_number", label: "CPF / Documento", max: 30 },
  { key: "birth_date", label: "Data de nascimento", type: "date", auto: "bday" },
  { key: "occupation", label: "Profissão", max: 80, auto: "organization-title" },
  { key: "address_line", label: "Endereço", max: 200, span: true, auto: "street-address" },
  { key: "city", label: "Cidade", max: 80, auto: "address-level2" },
  { key: "state", label: "Estado", max: 40, auto: "address-level1" },
  { key: "postal_code", label: "CEP", max: 15, auto: "postal-code" },
]

const COUNTRIES = [
  ["BR", "Brasil"],
  ["PT", "Portugal"],
  ["US", "Estados Unidos"],
  ["AR", "Argentina"],
  ["MX", "México"],
  ["CO", "Colômbia"],
  ["CL", "Chile"],
  ["ES", "Espanha"],
] as const

const EXPERIENCE = [
  ["beginner", "Iniciante (menos de 1 ano)"],
  ["intermediate", "Intermediário (1 a 3 anos)"],
  ["advanced", "Avançado (mais de 3 anos)"],
  ["professional", "Profissional"],
] as const

const inputCls =
  "h-10 w-full rounded border border-term-line bg-term-bg px-3 text-sm text-term-text outline-none focus:border-primary"

export function PersonalTab({ profile, onSave }: { profile: ProfileData; onSave: (p: Record<string, string | null>) => Promise<unknown> }) {
  const initial = () =>
    Object.fromEntries(
      [...FIELDS.map((f) => f.key), "country", "trading_experience"].map((k) => [k, (profile[k as keyof ProfileData] as string) ?? ""]),
    ) as Record<string, string>
  const [form, setForm] = useState(initial)
  const [saving, setSaving] = useState(false)
  const dirty = JSON.stringify(form) !== JSON.stringify(initial())
  const completion = profileCompletion(form)
  const issueKeys = new Set<string>(completion.issues.map((i) => i.key))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave(Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim() || null])))
      toast.success("Dados atualizados")
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6 rounded-md border border-term-line bg-term-panel p-4 md:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">Dados pessoais</h2>
        <p className="text-sm text-term-muted">Usados para verificação de identidade e saques.</p>
      </div>

      <div
        className={`flex flex-col gap-3 rounded border p-3 ${completion.complete ? "border-long/40 bg-long/5" : "border-term-line bg-term-bg"}`}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">
            {completion.complete ? "Cadastro completo — saques liberados" : "Complete o cadastro para liberar saques"}
          </p>
          <span className={`font-mono text-xs ${completion.complete ? "text-long" : "text-term-muted"}`}>{completion.percent}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-term-line">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${completion.percent}%` }} />
        </div>
        {!completion.complete && (
          <ul className="flex flex-wrap gap-1.5">
            {completion.issues.map((i) => (
              <li key={i.key} className="rounded bg-term-panel px-2 py-0.5 text-xs text-term-muted">
                {`${i.label}: ${i.problem}`}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 sm:col-span-2">
          <span className="text-xs text-term-muted">E-mail</span>
          <input value={profile.email} disabled className={`${inputCls} opacity-60`} />
        </label>
        {FIELDS.map((f) => (
          <label key={f.key} className={`flex flex-col gap-1.5 ${f.span ? "sm:col-span-2" : ""}`}>
            <span className="text-xs text-term-muted">
              {f.label}
              {REQUIRED.has(f.key) && <span className="text-short">{" *"}</span>}
            </span>
            <input
              type={f.type ?? "text"}
              required={REQUIRED.has(f.key)}
              aria-invalid={issueKeys.has(f.key) || undefined}
              value={form[f.key]}
              maxLength={f.max}
              autoComplete={f.auto}
              onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
              className={inputCls}
            />
          </label>
        ))}
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-term-muted">País</span>
          <select value={form.country} onChange={(e) => setForm((s) => ({ ...s, country: e.target.value }))} className={inputCls}>
            <option value="">Selecione</option>
            {COUNTRIES.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-term-muted">Experiência com trading</span>
          <select
            value={form.trading_experience || "beginner"}
            onChange={(e) => setForm((s) => ({ ...s, trading_experience: e.target.value }))}
            className={inputCls}
          >
            {EXPERIENCE.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center justify-end gap-3 border-t border-term-line pt-4">
        <button
          type="button"
          disabled={!dirty || saving}
          onClick={() => setForm(initial())}
          className="rounded px-4 py-2 text-sm text-term-muted hover:text-term-text disabled:opacity-40"
        >
          Descartar
        </button>
        <button
          type="submit"
          disabled={!dirty || saving}
          className="rounded bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40"
        >
          {saving ? "Salvando..." : "Salvar alterações"}
        </button>
      </div>
    </form>
  )
}
