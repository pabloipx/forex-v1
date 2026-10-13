"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { Eye, EyeOff, Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { AffiliateBrand } from "@/components/afiliadosbr/affiliate-brand"

export default function AffiliateLoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const check = async () => {
      const supabase = createClient()
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        router.replace("/afiliadosbr/painel")
        return
      }
      setChecking(false)
    }
    check()
  }, [router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isLoading) return

    const mail = email.trim().toLowerCase()
    const pass = password.trim()

    if (!mail || !pass) {
      setError("Preencha e-mail e senha")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: mail, password: pass })

      if (signInError) {
        const msg = signInError.message.toLowerCase()
        if (msg.includes("invalid login credentials") || msg.includes("invalid_credentials")) {
          throw new Error("E-mail ou senha incorretos")
        }
        if (msg.includes("email not confirmed")) throw new Error("Confirme seu e-mail antes de entrar")
        if (msg.includes("too many requests")) throw new Error("Muitas tentativas. Aguarde alguns minutos.")
        throw new Error(signInError.message)
      }

      router.push("/afiliadosbr/painel")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao entrar")
      setIsLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-[#fafafa]">
        <Loader2 className="w-7 h-7 animate-spin text-emerald-500" />
      </div>
    )
  }

  return (
    <div className="min-h-screen w-full bg-[#fafafa] flex flex-col items-center justify-center px-4 py-10 font-sans">
      <div className="w-full max-w-[490px] bg-white rounded-xl shadow-[0_1px_3px_rgba(16,24,40,0.08)] px-8 py-10 sm:px-12">
        <div className="flex items-center justify-center">
          <AffiliateBrand className="h-12" />
        </div>

        <h1 className="mt-6 text-center text-[26px] font-bold text-gray-900 tracking-tight">Entrar no Afiliados</h1>

        <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label htmlFor="aff-email" className="text-[15px] text-gray-700">
              Email
            </label>
            <input
              id="aff-email"
              type="email"
              autoComplete="email"
              placeholder="Digite seu e-mail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              className="h-12 w-full rounded-lg border border-gray-300 bg-white px-4 text-[15px] text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:opacity-60"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="aff-password" className="text-[15px] text-gray-700">
              Senha
            </label>
            <div className="relative">
              <input
                id="aff-password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Digite a sua senha"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading}
                className="h-12 w-full rounded-lg border border-gray-300 bg-white pl-4 pr-12 text-[15px] text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 disabled:opacity-60"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-600"
              >
                {showPassword ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <Link href="/auth/forgot-password" className="text-[15px] font-medium text-emerald-700 hover:underline">
            Esqueci minha senha :(
          </Link>

          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-emerald-400 text-[15px] font-semibold text-gray-900 transition-colors hover:bg-emerald-500 disabled:opacity-70"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Entrando...
              </>
            ) : (
              "Entrar"
            )}
          </button>

          <p className="text-center text-[15px] text-gray-600">
            Não tem uma conta?{" "}
            <Link href="/auth/sign-up" className="font-medium text-emerald-700 hover:underline">
              Registrar agora
            </Link>
          </p>
        </form>
      </div>

      <footer className="mt-8 flex flex-col items-center gap-4">
        <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2">
          <Image
            src="https://flagcdn.com/w40/br.png"
            alt="Brasil"
            width={20}
            height={20}
            className="h-5 w-5 rounded-full object-cover"
            unoptimized
          />
          <span className="text-[15px] text-gray-800">Português</span>
        </div>
        <div className="flex items-center gap-5 text-sm text-gray-500">
          <Link href="/help" className="hover:text-gray-800">
            Termos e Condições
          </Link>
          <Link href="/help" className="hover:text-gray-800">
            Política de Privacidade
          </Link>
        </div>
        <p className="flex items-center gap-4 text-sm text-gray-500">
          <span>afiliados@urynbroker.com</span>
          <span>© URYN-2026</span>
        </p>
      </footer>
    </div>
  )
}
