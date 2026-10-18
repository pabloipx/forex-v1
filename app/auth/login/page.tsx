"use client"

import type React from "react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { Eye, EyeOff, Loader2, ShieldAlert } from "lucide-react"
import { recordDeviceSession } from "@/lib/device-session"
import { AUTH_ACCENT, AUTH_ACCENT_TEXT, AUTH_INPUT, AUTH_LABEL, AuthLayout } from "@/components/auth/auth-layout"

async function getBlockStatus(
  supabase: ReturnType<typeof createClient>,
  userId: string,
): Promise<{ blocked: boolean; reason: string }> {
  const { data } = await supabase
    .from("profiles")
    .select("is_blocked, blocked_reason")
    .eq("id", userId)
    .maybeSingle()
  return { blocked: Boolean(data?.is_blocked), reason: (data?.blocked_reason ?? "").trim() }
}

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const [blockedReason, setBlockedReason] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const checkSession = async () => {
      try {
        const supabase = createClient()
        const { data } = await supabase.auth.getSession()
        if (data.session) {
          const ban = await getBlockStatus(supabase, data.session.user.id)
          if (ban.blocked) {
            await supabase.auth.signOut()
            setBlockedReason(ban.reason)
            setIsCheckingSession(false)
            return
          }
          router.replace("/futures")
        } else {
          setIsCheckingSession(false)
        }
      } catch {
        setIsCheckingSession(false)
      }
    }
    checkSession()
  }, [router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isLoading) return

    const trimmedEmail = email.trim().toLowerCase()
    const trimmedPassword = password.trim()

    if (!trimmedEmail || !trimmedPassword) {
      setError("Preencha todos os campos")
      return
    }

    setIsLoading(true)
    setError(null)
    setBlockedReason(null)

    try {
      const supabase = createClient()
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password: trimmedPassword,
      })

      if (signInError) {
        const msg = signInError.message.toLowerCase()
        if (msg.includes("invalid login credentials") || msg.includes("invalid_credentials")) {
          throw new Error("E-mail ou senha incorretos")
        }
        if (msg.includes("email not confirmed")) {
          throw new Error("Confirme seu e-mail antes de entrar")
        }
        if (msg.includes("too many requests")) {
          throw new Error("Muitas tentativas. Aguarde alguns minutos.")
        }
        throw new Error(signInError.message)
      }

      const ban = await getBlockStatus(supabase, signInData.user.id)
      if (ban.blocked) {
        await supabase.auth.signOut()
        setBlockedReason(ban.reason)
        setIsLoading(false)
        return
      }

      // Registra este dispositivo/navegador para a tela "Dispositivos conectados".
      await recordDeviceSession()

      router.push("/futures")
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao fazer login"
      setError(message)
      setIsLoading(false)
    }
  }

  if (isCheckingSession) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#f5f6fa]">
        <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <AuthLayout
      title={<h1 className="text-xl font-semibold text-gray-900">Entrar</h1>}
      switchHref="/auth/sign-up"
      switchLabel="Criar conta"
    >
      <form onSubmit={handleLogin} className="flex flex-col gap-4 px-6 pt-7 pb-10">
        <div className="flex flex-col gap-2">
          <label htmlFor="email" className={AUTH_LABEL}>
            E-mail
          </label>
          <input
            id="email"
            type="email"
            placeholder="seu@email.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            disabled={isLoading}
            className={AUTH_INPUT}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="password" className={AUTH_LABEL}>
            Senha
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Sua senha"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={isLoading}
              className={`${AUTH_INPUT} pr-11`}
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <Link href="/auth/forgot-password" className={`self-end text-sm ${AUTH_ACCENT_TEXT} hover:underline`}>
          Esqueceu sua senha?
        </Link>

        {blockedReason !== null && (
          <div role="alert" className="flex gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
            <ShieldAlert className="w-5 h-5 shrink-0 text-red-600 mt-0.5" aria-hidden="true" />
            <div className="flex flex-col gap-1 min-w-0">
              <p className="text-sm font-semibold text-red-700">Sua conta foi bloqueada</p>
              <p className="text-sm leading-relaxed text-red-700/90 whitespace-pre-line break-words">
                <span className="font-medium">Motivo:</span> {blockedReason || "Não informado."}
              </p>
              <p className="text-xs leading-relaxed text-red-600/80">
                Se acredita que houve um engano, entre em contato com o suporte.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div role="alert" className="text-sm p-3 rounded-lg text-red-600 bg-red-50 border border-red-200">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className={`mt-1 w-full h-12 rounded-full font-semibold text-base flex items-center justify-center gap-2 transition-colors disabled:opacity-70 ${AUTH_ACCENT}`}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Entrando...
            </>
          ) : (
            "Entrar"
          )}
        </button>

        <p className="text-center text-gray-500 text-sm">
          Não tem uma conta?{" "}
          <Link href="/auth/sign-up" className={`font-semibold ${AUTH_ACCENT_TEXT} hover:underline`}>
            Criar conta
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
