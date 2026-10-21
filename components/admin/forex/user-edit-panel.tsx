"use client"

import { useState, type FormEvent } from "react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { SmallButton, inputCls } from "./ui"
import { adminAction, refreshAdmin, usd } from "./use-admin"

type Profile = Record<string, string | number | boolean | null>

const PROFILE_FIELDS: { key: string; label: string; type?: string; inputMode?: "tel" | "numeric" | "email"; wide?: boolean }[] = [
  { key: "full_name", label: "Nome completo", wide: true },
  { key: "email", label: "E-mail", type: "email", inputMode: "email", wide: true },
  { key: "phone", label: "Celular", type: "tel", inputMode: "tel" },
  { key: "nickname", label: "Apelido" },
  { key: "document_number", label: "CPF / Documento", inputMode: "numeric" },
  { key: "birth_date", label: "Nascimento", type: "date" },
  { key: "occupation", label: "Profissão" },
  { key: "address_line", label: "Endereço", wide: true },
  { key: "city", label: "Cidade" },
  { key: "state", label: "Estado" },
  { key: "postal_code", label: "CEP", inputMode: "numeric" },
  { key: "country", label: "País" },
]

const str = (v: unknown) => (v == null ? "" : String(v))

function BalanceEditor({ userId, balances, onSaved }: { userId: string; balances: { real: number; demo: number }; onSaved: () => void }) {
  const [isDemo, setIsDemo] = useState(false)
  const current = isDemo ? balances.demo : balances.real
  const [value, setValue] = useState("")
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)

  const target = Number(value.replace(",", "."))
  const valid = value.trim() !== "" && Number.isFinite(target) && target >= 0
  const delta = valid ? target - current : 0

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!valid || delta === 0) return
    setBusy(true)
    try {
      await adminAction({ action: "set_balance", userId, isDemo, balance: target, note: note || null })
      toast.success(`Saldo ${isDemo ? "demo" : "real"} definido para ${usd(target)}`)
      setValue("")
      setNote("")
      refreshAdmin("users", "adjustments", "overview")
      onSaved()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const seg = (on: boolean) =>
    cn("h-10 flex-1 rounded-md text-sm font-medium transition-colors", on ? "bg-term-panel text-term-text shadow-sm" : "text-term-muted hover:text-term-text")

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-xl border border-term-line bg-term-bg p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-sm font-semibold">Definir saldo</h3>
          <p className="text-xs leading-relaxed text-term-muted">Digite o valor final. A diferença fica registrada no histórico de ajustes.</p>
        </div>
      </div>

      <div role="radiogroup" aria-label="Conta" className="flex gap-1 rounded-lg bg-term-line/60 p-1">
        <button type="button" role="radio" aria-checked={!isDemo} className={seg(!isDemo)} onClick={() => setIsDemo(false)}>
          Real · {usd(balances.real)}
        </button>
        <button type="button" role="radio" aria-checked={isDemo} className={seg(isDemo)} onClick={() => setIsDemo(true)}>
          Demo · {usd(balances.demo)}
        </button>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-term-muted">Novo saldo (USD)</span>
        <input
          className={cn(inputCls, "h-12 text-lg md:h-11 md:text-lg")}
          inputMode="decimal"
          placeholder={current.toFixed(2)}
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/[^\d.,]/g, ""))}
        />
      </label>

      <div className="flex flex-wrap gap-2">
        {[0, 100, 500, 1000, 5000].map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setValue(String(v))}
            className="h-9 rounded-md border border-term-line px-3 font-mono text-xs text-term-muted transition-colors hover:border-primary hover:text-term-text"
          >
            {usd(v, 0)}
          </button>
        ))}
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-term-muted">Motivo (opcional)</span>
        <input className={cn(inputCls, "font-sans")} maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: correção de depósito" />
      </label>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-mono text-xs tabular-nums text-term-muted" aria-live="polite">
          {valid && delta !== 0 ? (
            <>
              Diferença: <span className={delta > 0 ? "text-long" : "text-short"}>{`${delta > 0 ? "+" : ""}${usd(delta)}`}</span>
            </>
          ) : (
            "Sem alteração"
          )}
        </p>
        <SmallButton type="submit" tone="accent" disabled={busy || !valid || delta === 0}>
          {busy ? "Salvando..." : "Aplicar saldo"}
        </SmallButton>
      </div>
    </form>
  )
}

function ProfileEditor({ userId, profile, onSaved }: { userId: string; profile: Profile; onSaved: () => void }) {
  const initial = Object.fromEntries(PROFILE_FIELDS.map((f) => [f.key, str(profile[f.key]).slice(0, f.type === "date" ? 10 : undefined)]))
  const [form, setForm] = useState<Record<string, string>>(initial)
  const [busy, setBusy] = useState(false)
  const changed = PROFILE_FIELDS.filter((f) => form[f.key] !== initial[f.key])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!changed.length) return
    const patch: Record<string, string | null> = {}
    for (const f of changed) patch[f.key] = form[f.key].trim() || null
    if ("email" in patch && !patch.email) {
      toast.error("O e-mail não pode ficar vazio")
      return
    }
    setBusy(true)
    try {
      await adminAction({ action: "update_profile", userId, profile: patch })
      toast.success("Dados do usuário atualizados")
      refreshAdmin("users")
      onSaved()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 rounded-xl border border-term-line bg-term-bg p-4">
      <div className="flex flex-col gap-0.5">
        <h3 className="text-sm font-semibold">Dados do usuário</h3>
        <p className="text-xs leading-relaxed text-term-muted">Alterar o e-mail muda também o login do cliente.</p>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {PROFILE_FIELDS.map((f) => (
          <label key={f.key} className={cn("flex flex-col gap-1.5", f.wide && "sm:col-span-2")}>
            <span className="text-xs text-term-muted">{f.label}</span>
            <input
              className={cn(inputCls, "font-sans", form[f.key] !== initial[f.key] && "border-primary/60")}
              type={f.type ?? "text"}
              inputMode={f.inputMode}
              value={form[f.key]}
              onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
            />
          </label>
        ))}
      </div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-term-muted">{changed.length ? `${changed.length} campo(s) alterado(s)` : "Nenhuma alteração"}</p>
        <div className="flex gap-2">
          {changed.length > 0 && (
            <SmallButton tone="muted" onClick={() => setForm(initial)} disabled={busy}>
              Desfazer
            </SmallButton>
          )}
          <SmallButton type="submit" tone="accent" disabled={busy || !changed.length}>
            {busy ? "Salvando..." : "Salvar dados"}
          </SmallButton>
        </div>
      </div>
    </form>
  )
}

export function UserEditPanel({
  userId,
  profile,
  balances,
  onSaved,
}: {
  userId: string
  profile: Profile
  balances: { real: number; demo: number }
  onSaved: () => void
}) {
  return (
    <div className="flex flex-col gap-4">
      <BalanceEditor userId={userId} balances={balances} onSaved={onSaved} />
      <ProfileEditor key={JSON.stringify(profile)} userId={userId} profile={profile} onSaved={onSaved} />
    </div>
  )
}
