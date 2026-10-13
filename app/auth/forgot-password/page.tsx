"use client"

import type React from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Link from "next/link"
import Image from "next/image"
import { useState } from "react"
import { LockKeyhole, Loader2, CheckCircle2 } from "lucide-react"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (isLoading) return

    const trimmedEmail = email.trim().toLowerCase()

    if (!trimmedEmail) {
      setError("Digite seu e-mail")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })

      if (resetError) {
        const msg = resetError.message.toLowerCase()
        if (msg.includes("too many requests")) {
          throw new Error("Muitas tentativas. Aguarde alguns minutos.")
        }
        throw new Error(resetError.message)
      }

      setSent(true)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao enviar e-mail de recuperação"
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-white">
      {/* Header fino com a logo e acesso ao cadastro */}
      <header className="flex items-center justify-between border-b border-gray-100 px-5 py-3 sm:px-8">
        <Link href="/" className="flex items-center">
          <Image
            src="/images/uryn-fox-logo.png"
            alt="URYNBROKER"
            width={180}
            height={44}
            className="h-8 w-auto sm:h-9"
            unoptimized
          />
        </Link>
        <Link href="/auth/sign-up">
          <Button className="h-10 rounded-md bg-orange-500 px-6 font-medium text-white hover:bg-orange-600">
            Registrar-se
          </Button>
        </Link>
      </header>

      {/* Conteudo centralizado verticalmente na pagina */}
      <main className="flex flex-1 items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm text-center">
          {sent ? (
            <>
              <h1 className="text-2xl font-bold text-balance text-gray-800 sm:text-3xl">Verifique seu e-mail</h1>

              <div className="my-7 flex justify-center">
                <span className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50">
                  <CheckCircle2 className="h-9 w-9 text-emerald-600" strokeWidth={1.75} />
                </span>
              </div>

              <p className="text-sm leading-relaxed text-gray-600 text-pretty">
                {"Enviamos um link de recuperação para "}
                <span className="font-medium text-gray-800">{email.trim().toLowerCase()}</span>
                {". Abra o e-mail e clique no link para criar uma nova senha."}
              </p>

              <p className="mt-4 text-xs leading-relaxed text-gray-400">
                Não recebeu? Verifique a caixa de spam ou tente novamente em alguns minutos.
              </p>

              <Button
                onClick={() => {
                  setSent(false)
                  setError(null)
                }}
                className="mt-7 h-12 w-full rounded-md bg-orange-500 text-base font-medium text-white hover:bg-orange-600"
              >
                Enviar para outro e-mail
              </Button>

              <Link
                href="/auth/login"
                className="mt-4 block text-sm text-orange-600 transition-colors hover:text-orange-700"
              >
                Voltar ao login
              </Link>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-balance text-gray-800 sm:text-3xl">Recuperação de senha</h1>

              <div className="my-7 flex justify-center">
                <span className="flex h-20 w-20 items-center justify-center rounded-full bg-orange-50">
                  <LockKeyhole className="h-9 w-9 text-orange-500" strokeWidth={1.75} />
                </span>
              </div>

              <p className="text-sm leading-relaxed text-gray-600 text-pretty">
                Para começar o processo de alteração de sua senha, digite seu e-mail
              </p>

              <form onSubmit={handleSubmit} className="mt-6 text-left">
                <label htmlFor="email" className="sr-only">
                  E-mail
                </label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  disabled={isLoading}
                  className="h-12 rounded-md border border-gray-300 bg-white text-gray-800 placeholder:text-gray-400 focus-visible:border-orange-500 focus-visible:ring-2 focus-visible:ring-orange-500/25 disabled:opacity-50"
                />

                {error && (
                  <p role="alert" className="mt-3 text-sm text-red-600">
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-md bg-orange-500 text-base font-medium text-white transition-colors hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    "Enviar"
                  )}
                </Button>
              </form>

              <Link
                href="/auth/login"
                className="mt-5 block text-sm text-orange-600 transition-colors hover:text-orange-700"
              >
                Voltar ao login
              </Link>

              <p className="mt-3 text-sm text-gray-600">
                {"Ainda não possui uma conta? "}
                <Link href="/auth/sign-up" className="text-orange-600 transition-colors hover:text-orange-700">
                  Inscrever-se
                </Link>
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  )
}
