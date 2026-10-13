"use client"

import type React from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { Lock, ArrowRight, Loader2, CheckCircle2 } from "lucide-react"

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [validSession, setValidSession] = useState<boolean | null>(null)
  const router = useRouter()

  // Ao chegar pelo link do e-mail, o Supabase cria uma sessao de recuperacao.
  // Verificamos se ela existe para permitir a troca de senha.
  useEffect(() => {
    const supabase = createClient()

    const { data: subscription } = supabase.auth.onAuthStateChange((event: any, session: any) => {
      if (event === "PASSWORD_RECOVERY" || session) {
        setValidSession(true)
      }
    })

    supabase.auth.getSession().then(({ data: { session } }: any) => {
      setValidSession(!!session)
    })

    return () => {
      subscription.subscription.unsubscribe()
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isLoading) return

    const trimmedPassword = password.trim()
    const trimmedConfirm = confirmPassword.trim()

    if (trimmedPassword.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres")
      return
    }

    if (trimmedPassword !== trimmedConfirm) {
      setError("As senhas não coincidem")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      const { error: updateError } = await supabase.auth.updateUser({ password: trimmedPassword })

      if (updateError) {
        const msg = updateError.message.toLowerCase()
        if (msg.includes("should be different") || msg.includes("same as the old")) {
          throw new Error("A nova senha deve ser diferente da anterior")
        }
        if (msg.includes("session") || msg.includes("expired")) {
          throw new Error("O link expirou. Solicite a recuperação de senha novamente.")
        }
        throw new Error(updateError.message)
      }

      setSuccess(true)
      setTimeout(() => router.replace("/trade"), 2000)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao redefinir a senha"
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full" style={{ backgroundColor: "#0B0F14" }}>
      {/* Header */}
      <header className="flex items-center justify-between px-5 py-4">
        <Link href="/" className="flex items-center">
          <Image
            src="/images/kodilex-logo.png"
            alt="URYN BROKER"
            width={160}
            height={40}
            className="h-10 w-auto"
            unoptimized
          />
        </Link>
      </header>

      {success ? (
        /* Success State */
        <div className="px-5 pt-12 pb-8">
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
            style={{ backgroundColor: "rgba(0, 230, 118, 0.15)" }}
          >
            <CheckCircle2 className="w-9 h-9" style={{ color: "#00E676" }} />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2 text-balance">Senha redefinida!</h1>
          <p className="text-gray-400 text-sm leading-relaxed">
            Sua senha foi alterada com sucesso. Redirecionando para a plataforma...
          </p>
        </div>
      ) : validSession === false ? (
        /* Invalid / Expired link */
        <div className="px-5 pt-12 pb-8">
          <h1 className="text-2xl font-bold text-white mb-2 text-balance">Link inválido ou expirado</h1>
          <p className="text-gray-400 text-sm leading-relaxed mb-6">
            Este link de recuperação não é mais válido. Solicite um novo para redefinir sua senha.
          </p>
          <Link href="/auth/forgot-password" className="block">
            <Button className="w-full text-white h-12 rounded-xl" style={{ backgroundColor: "#f97316" }}>
              Solicitar novo link
            </Button>
          </Link>
        </div>
      ) : (
        <>
          {/* Hero Section */}
          <div className="px-5 pt-8 pb-6">
            <h1 className="text-2xl font-bold text-white mb-1 text-balance">Criar nova senha</h1>
            <p className="text-gray-400 text-sm leading-relaxed">Escolha uma nova senha para acessar sua conta.</p>
          </div>

          {/* Form */}
          <div className="px-5 pb-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-white text-sm font-medium flex items-center gap-2">
                  <Lock className="w-4 h-4" style={{ color: "#f97316" }} />
                  Nova senha
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Digite a nova senha"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={isLoading}
                  className="text-white placeholder:text-gray-500 h-12 rounded-xl border-0 focus:ring-2 disabled:opacity-50"
                  style={{ backgroundColor: "#1a2332", boxShadow: "inset 0 2px 4px rgba(0,0,0,0.2)" }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-white text-sm font-medium flex items-center gap-2">
                  <Lock className="w-4 h-4" style={{ color: "#f97316" }} />
                  Confirmar senha
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Digite a senha novamente"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  disabled={isLoading}
                  className="text-white placeholder:text-gray-500 h-12 rounded-xl border-0 focus:ring-2 disabled:opacity-50"
                  style={{ backgroundColor: "#1a2332", boxShadow: "inset 0 2px 4px rgba(0,0,0,0.2)" }}
                />
              </div>

              {error && (
                <div
                  className="text-sm p-3 rounded-xl flex items-center gap-2"
                  style={{ color: "#EF4444", backgroundColor: "rgba(239, 68, 68, 0.1)" }}
                >
                  <span className="text-red-500">!</span>
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full text-white h-14 rounded-xl font-semibold text-base transition-all duration-200 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed disabled:hover:scale-100"
                style={{ backgroundColor: "#f97316", boxShadow: "0 4px 14px rgba(249, 115, 22, 0.4)" }}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    Redefinir senha
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </Button>
            </form>
          </div>
        </>
      )}
    </div>
  )
}
