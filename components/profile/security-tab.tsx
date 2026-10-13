"use client"

import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { LogOut } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import type { ProfileData } from "./use-profile"

const inputCls =
  "h-10 w-full rounded border border-term-line bg-term-bg px-3 text-sm text-term-text outline-none focus:border-primary"

const fmt = (d: string | null) => (d ? new Date(d).toLocaleString("pt-BR") : "—")

export function SecurityTab({ profile }: { profile: ProfileData }) {
  const router = useRouter()
  const [current, setCurrent] = useState("")
  const [next, setNext] = useState("")
  const [confirm, setConfirm] = useState("")
  const [saving, setSaving] = useState(false)
  const [leaving, setLeaving] = useState(false)

  const changePassword = async (e: FormEvent) => {
    e.preventDefault()
    if (next !== confirm) {
      toast.error("A confirmação não confere com a nova senha")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/futures/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? "Falha ao alterar a senha")
      toast.success("Senha alterada")
      setCurrent("")
      setNext("")
      setConfirm("")
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const logout = async () => {
    setLeaving(true)
    await fetch("/api/auth/test-login", { method: "DELETE" }).catch(() => null)
    try {
      await createClient().auth.signOut()
    } catch {
      // Sem Supabase configurado: o cookie de teste já foi removido.
    }
    router.replace("/auth/login")
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={changePassword} className="flex flex-col gap-4 rounded-md border border-term-line bg-term-panel p-4 md:p-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold">Alterar senha</h2>
          <p className="text-sm text-term-muted">Mínimo de 8 caracteres, com letras e números.</p>
        </div>
        {profile.testMode && (
          <p className="rounded border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary">
            Modo teste ativo (sem banco de dados): a troca de senha fica disponível quando o Supabase estiver configurado.
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-term-muted">Senha atual</span>
            <input type="password" required autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-term-muted">Nova senha</span>
            <input type="password" required minLength={8} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs text-term-muted">Confirmar nova senha</span>
            <input type="password" required minLength={8} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputCls} />
          </label>
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving || profile.testMode}
            className="rounded bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40"
          >
            {saving ? "Alterando..." : "Alterar senha"}
          </button>
        </div>
      </form>

      <section className="flex flex-col gap-3 rounded-md border border-term-line bg-term-panel p-4 md:p-6">
        <h2 className="text-base font-semibold">Conta e acesso</h2>
        <dl className="grid gap-x-6 sm:grid-cols-2">
          {[
            ["ID da conta", profile.id],
            ["Membro desde", fmt(profile.created_at)],
            ["Último acesso", fmt(profile.last_login_at)],
            ["Verificação", profile.kyc_status === "approved" ? "Aprovada" : "Pendente"],
          ].map(([l, v]) => (
            <div key={l} className="flex items-center justify-between gap-4 border-b border-term-line py-2 text-sm">
              <dt className="text-term-muted">{l}</dt>
              <dd className="truncate font-mono text-xs">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <Link href="/kyc" className="text-sm font-medium text-primary hover:underline">
            Documentos de verificação
          </Link>
          <button
            type="button"
            onClick={logout}
            disabled={leaving}
            className="flex items-center gap-2 rounded border border-short/50 px-4 py-2 text-sm font-semibold text-short hover:bg-short/10 disabled:opacity-50"
          >
            <LogOut className="size-4" aria-hidden />
            {leaving ? "Saindo..." : "Sair da conta"}
          </button>
        </div>
      </section>
    </div>
  )
}
