"use client"

import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { toast } from "sonner"
import { RotateCcw, ShieldCheck, ShieldOff, MonitorX } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

const inputCls =
  "h-10 w-full rounded border border-term-line bg-term-bg px-3 text-sm text-term-text outline-none focus:border-primary"

async function loadFactors() {
  const { data, error } = await createClient().auth.mfa.listFactors()
  if (error) throw error
  return data.totp.find((f: { id: string; status: string }) => f.status === "verified") ?? null
}

export function TwoFactorSection() {
  const { data: factor, mutate, isLoading } = useSWR("mfa-factors", loadFactors)
  const [enroll, setEnroll] = useState<{ id: string; qr: string; secret: string } | null>(null)
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)

  const start = async () => {
    setBusy(true)
    try {
      const supabase = createClient()
      const { data: list } = await supabase.auth.mfa.listFactors()
      for (const f of list?.all ?? []) {
        if (f.status === "unverified") await supabase.auth.mfa.unenroll({ factorId: f.id })
      }
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: `totp-${Date.now()}` })
      if (error) throw error
      setEnroll({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret })
    } catch {
      toast.error("Não foi possível iniciar a ativação do 2FA")
    } finally {
      setBusy(false)
    }
  }

  const verify = async (e: FormEvent) => {
    e.preventDefault()
    if (!enroll) return
    setBusy(true)
    try {
      const supabase = createClient()
      const challenge = await supabase.auth.mfa.challenge({ factorId: enroll.id })
      if (challenge.error) throw challenge.error
      const res = await supabase.auth.mfa.verify({ factorId: enroll.id, challengeId: challenge.data.id, code: code.trim() })
      if (res.error) throw res.error
      toast.success("Autenticação em dois fatores ativada")
      setEnroll(null)
      setCode("")
      mutate()
    } catch {
      toast.error("Código inválido. Confira o horário do celular e tente novamente.")
    } finally {
      setBusy(false)
    }
  }

  const disable = async () => {
    if (!factor || !confirm("Desativar a autenticação em dois fatores?")) return
    setBusy(true)
    const { error } = await createClient().auth.mfa.unenroll({ factorId: factor.id })
    setBusy(false)
    if (error) toast.error("Para desativar, faça login novamente com o código 2FA")
    else {
      toast.success("2FA desativado")
      mutate()
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-md border border-term-line bg-term-panel p-4 md:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-base font-semibold">Autenticação em dois fatores (TOTP)</h2>
          <p className="text-sm leading-relaxed text-term-muted">
            Use Google Authenticator, Authy ou outro app TOTP para gerar códigos de acesso.
          </p>
        </div>
        <span
          className={`flex shrink-0 items-center gap-1.5 rounded px-2 py-1 text-xs font-semibold ${
            factor ? "bg-long/15 text-long" : "bg-term-line text-term-muted"
          }`}
        >
          {factor ? <ShieldCheck className="size-3.5" aria-hidden /> : <ShieldOff className="size-3.5" aria-hidden />}
          {isLoading ? "..." : factor ? "Ativado" : "Desativado"}
        </span>
      </div>

      {enroll ? (
        <form onSubmit={verify} className="flex flex-col gap-4 sm:flex-row sm:items-start">
          {/* eslint-disable-next-line @next/next/no-img-element -- QR em data URL gerado pelo Supabase */}
          <img src={enroll.qr} alt="QR code para o app autenticador" className="size-40 rounded bg-foreground p-2" />
          <div className="flex flex-1 flex-col gap-3">
            <p className="text-sm text-term-muted">
              Chave manual: <code className="break-all font-mono text-xs text-term-text">{enroll.secret}</code>
            </p>
            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-term-muted">Código de 6 dígitos</span>
              <input
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className={`${inputCls} max-w-40 font-mono tracking-widest`}
              />
            </label>
            <div className="flex gap-2">
              <button type="submit" disabled={busy || code.length !== 6} className="rounded bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40">
                Confirmar
              </button>
              <button type="button" onClick={() => setEnroll(null)} className="rounded border border-term-line px-4 py-2 text-sm hover:bg-term-line">
                Cancelar
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div className="flex justify-end">
          {factor ? (
            <button type="button" onClick={disable} disabled={busy} className="rounded border border-short/50 px-4 py-2 text-sm font-semibold text-short hover:bg-short/10 disabled:opacity-50">
              Desativar 2FA
            </button>
          ) : (
            <button type="button" onClick={start} disabled={busy || isLoading} className="rounded bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40">
              {busy ? "Gerando..." : "Ativar 2FA"}
            </button>
          )}
        </div>
      )}
    </section>
  )
}

export function DemoResetSection() {
  const [busy, setBusy] = useState(false)
  const reset = async () => {
    if (!confirm("Resetar a conta demo? Ordens abertas serão canceladas, posições demo fechadas e o saldo restaurado.")) return
    setBusy(true)
    try {
      const res = await fetch("/api/futures/demo/reset", { method: "POST" })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? "Falha ao resetar")
      toast.success(`Conta demo resetada: saldo de ${Number(json.balance).toLocaleString("pt-BR", { style: "currency", currency: "USD" })}`)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-primary/30 bg-term-panel p-4 md:p-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">Conta demo</h2>
        <p className="text-sm leading-relaxed text-term-muted">Saldo fictício, sem dinheiro real. Restaure o saldo inicial quando quiser.</p>
      </div>
      <button type="button" onClick={reset} disabled={busy} className="flex items-center gap-2 rounded border border-primary/50 px-4 py-2 text-sm font-semibold text-primary hover:bg-primary/10 disabled:opacity-50">
        <RotateCcw className="size-4" aria-hidden />
        {busy ? "Resetando..." : "Resetar conta demo"}
      </button>
    </section>
  )
}

export function GlobalSignOutButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const run = async () => {
    if (!confirm("Encerrar a sessão em todos os dispositivos, inclusive este?")) return
    setBusy(true)
    await createClient().auth.signOut({ scope: "global" }).catch(() => null)
    router.replace("/auth/login")
    router.refresh()
  }
  return (
    <button type="button" onClick={run} disabled={busy} className="flex items-center gap-2 rounded border border-term-line px-4 py-2 text-sm font-semibold hover:bg-term-line disabled:opacity-50">
      <MonitorX className="size-4" aria-hidden />
      {busy ? "Encerrando..." : "Sair de todos os dispositivos"}
    </button>
  )
}
