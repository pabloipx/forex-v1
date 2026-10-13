"use client"

import type React from "react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { Loader2 } from "lucide-react"
import { recordDeviceSession } from "@/lib/device-session"

function Flag({ code, className }: { code: string; className?: string }) {
  return (
    <Image
      src={`https://flagcdn.com/w40/${code.toLowerCase()}.png`}
      alt={code}
      width={24}
      height={18}
      className={className}
      unoptimized
    />
  )
}

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isCheckingSession, setIsCheckingSession] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const checkSession = async () => {
      try {
        const supabase = createClient()
        const { data } = await supabase.auth.getSession()
        if (data.session) {
          router.replace("/trade")
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

    try {
      const supabase = createClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({
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

      // Registra este dispositivo/navegador para a tela "Dispositivos conectados".
      await recordDeviceSession()

      router.push("/trade")
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao fazer login"
      setError(message)
      setIsLoading(false)
    }
  }

  if (isCheckingSession) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-white">
        <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const inputClass =
    "w-full h-12 px-4 rounded-md bg-white text-gray-800 text-[15px] border border-gray-300 outline-none transition-colors placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50"

  return (
    <div className="min-h-screen w-full bg-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-gray-100 bg-gray-50/60">
        <Link href="/" className="flex items-center">
          <Image src="/images/uryn-fox-logo.png" alt="URYNBROKER" width={150} height={38} className="h-9 w-auto" unoptimized />
        </Link>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-gray-600 text-sm font-medium">
            <Flag code="BR" className="rounded-full w-5 h-5 object-cover" />
            Pt
          </div>
          <Link
            href="/auth/sign-up"
            className="rounded-md border border-blue-500 text-blue-600 hover:bg-blue-50 px-6 h-10 flex items-center font-medium text-sm transition-colors"
          >
            Registrar-se
          </Link>
        </div>
      </header>

      {/* Form */}
      <main className="flex-1 flex flex-col items-center px-5 py-10">
        <h1 className="text-3xl font-semibold text-gray-500 mb-8 text-center">Entrar</h1>

        <form onSubmit={handleLogin} className="w-full max-w-[420px] flex flex-col gap-4">
          <input
            type="email"
            placeholder="E-mail"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            disabled={isLoading}
            className={inputClass}
          />
          <input
            type="password"
            placeholder="Senha"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            disabled={isLoading}
            className={inputClass}
          />

          <div className="text-right -mt-1">
            <Link href="/auth/forgot-password" className="text-sm text-blue-600 hover:underline">
              Esqueceu sua senha?
            </Link>
          </div>

          {error && (
            <div className="text-sm p-3 rounded-md flex items-center gap-2 text-red-600 bg-red-50 border border-red-200">
              <span>⚠</span>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-14 rounded-md text-white font-semibold text-base bg-green-600 hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Entrando...
              </>
            ) : (
              "Entrar"
            )}
          </button>

          <p className="text-center text-gray-500 text-sm pt-2">
            Não tem uma conta?{" "}
            <Link href="/auth/sign-up" className="font-semibold text-blue-600 hover:underline">
              Registrar-se
            </Link>
          </p>
        </form>
      </main>
    </div>
  )
}
