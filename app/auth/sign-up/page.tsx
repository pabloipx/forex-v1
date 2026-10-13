"use client"

import type React from "react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect, Suspense } from "react"
import { CheckCircle2, ChevronDown, Loader2, X } from "lucide-react"
import { recordDeviceSession } from "@/lib/device-session"

const COUNTRIES = [
  { name: "Brasil", code: "BR", dial: "+55" },
  { name: "Portugal", code: "PT", dial: "+351" },
  { name: "Angola", code: "AO", dial: "+244" },
  { name: "Moçambique", code: "MZ", dial: "+258" },
  { name: "Argentina", code: "AR", dial: "+54" },
  { name: "Estados Unidos", code: "US", dial: "+1" },
  { name: "Espanha", code: "ES", dial: "+34" },
]

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

function SignUpForm() {
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [country, setCountry] = useState(COUNTRIES[0])
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [phone, setPhone] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  const [showCountries, setShowCountries] = useState(false)
  const [referralCode, setReferralCode] = useState("")
  const [referralSubId, setReferralSubId] = useState("")
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const ref = searchParams.get("ref")
    if (ref) setReferralCode(ref.toUpperCase())
    // subid identifica a campanha do afiliado (?ref=CODE&subid=instagram)
    const subid = searchParams.get("subid") ?? searchParams.get("sub_id")
    if (subid) setReferralSubId(subid.slice(0, 64))
  }, [searchParams])

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const numbers = e.target.value.replace(/\D/g, "")
    setPhone(numbers.slice(0, 13))
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres")
      setIsLoading(false)
      return
    }

    const fullName = `${firstName} ${lastName}`.trim()

    try {
      const res = await fetch("/api/auth/sign-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          fullName,
          phone: `${country.dial} ${phone}`.trim(),
          referralCode,
          referralSubId,
        }),
      })

      const result = await res.json()
      if (!res.ok) throw new Error(result.error || "Erro ao criar conta")

      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) {
        console.error("[v0] Sign-in error:", signInError)
        throw new Error("Conta criada, mas houve erro ao entrar. Tente fazer login.")
      }

      await recordDeviceSession()

      setSuccess(true)
      setTimeout(() => router.push("/trade"), 2000)
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : "Erro ao criar conta"
      if (errMsg.includes("already registered")) {
        setError("Este e-mail já está cadastrado")
      } else {
        setError(errMsg)
      }
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-white">
        <div className="text-center px-6 animate-in fade-in zoom-in duration-500">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center bg-green-100">
            <CheckCircle2 className="w-12 h-12 text-green-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Conta criada com sucesso!</h1>
          <p className="text-gray-500 mb-6">Você será redirecionado para a plataforma...</p>
          <div className="flex items-center justify-center gap-2 text-green-600">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Entrando...</span>
          </div>
        </div>
      </div>
    )
  }

  const inputClass =
    "w-full h-12 px-4 rounded-md bg-white text-gray-800 text-[15px] border border-gray-300 outline-none transition-colors placeholder:text-gray-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"

  return (
    <div className="min-h-screen w-full bg-white flex flex-col">
      {/* Modal de Termos */}
      {showTerms && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="relative w-full max-w-lg max-h-[85vh] rounded-2xl overflow-hidden flex flex-col bg-white shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h2 className="text-lg font-bold text-gray-800">Termos e Condições de Uso</h2>
              <button onClick={() => setShowTerms(false)} className="p-2 rounded-full hover:bg-gray-100 transition-colors">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 text-gray-600 text-sm leading-relaxed space-y-3">
              <p className="text-xs text-gray-400">Última atualização: Janeiro de 2026</p>
              <p>
                Ao acessar, cadastrar-se ou utilizar a plataforma URYN BROKER, o usuário declara que leu, compreendeu e
                concorda integralmente com os presentes Termos e Condições.
              </p>
              <h3 className="text-gray-800 font-semibold pt-1">1. Elegibilidade</h3>
              <p>A utilização é exclusiva para pessoas maiores de 18 anos.</p>
              <h3 className="text-gray-800 font-semibold pt-1">2. Cadastro</h3>
              <p>O usuário compromete-se a fornecer informações verdadeiras e completas.</p>
              <h3 className="text-gray-800 font-semibold pt-1">3. Riscos</h3>
              <p>Operações financeiras envolvem riscos e podem resultar em perdas. A URYN BROKER não garante lucros.</p>
            </div>
            <div className="p-4 border-t border-gray-200">
              <button
                onClick={() => setShowTerms(false)}
                className="w-full h-12 rounded-md text-white font-semibold bg-green-600 hover:bg-green-700 transition-colors"
              >
                Li e Entendi
              </button>
            </div>
          </div>
        </div>
      )}

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
            href="/auth/login"
            className="rounded-md border border-blue-500 text-blue-600 hover:bg-blue-50 px-6 h-10 flex items-center font-medium text-sm transition-colors"
          >
            Entrar
          </Link>
        </div>
      </header>

      {/* Form */}
      <main className="flex-1 flex flex-col items-center px-5 py-10">
        <h1 className="text-3xl font-semibold text-gray-500 mb-8 text-center">Registrar-se</h1>

        <form onSubmit={handleSignUp} className="w-full max-w-[420px] flex flex-col gap-4">
          <input
            type="text"
            placeholder="Nome"
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className={inputClass}
          />
          <input
            type="text"
            placeholder="Sobrenome"
            required
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className={inputClass}
          />

          {/* País */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowCountries((v) => !v)}
              className="w-full h-12 px-4 rounded-md bg-white border border-gray-300 flex items-center justify-between text-gray-800 text-[15px] focus:border-blue-500 outline-none"
            >
              <span className="flex items-center gap-2">
                <Flag code={country.code} className="rounded-full w-5 h-5 object-cover" />
                {country.name}
              </span>
              <ChevronDown className="w-5 h-5 text-gray-400" />
            </button>
            {showCountries && (
              <div className="absolute z-20 mt-1 w-full rounded-md border border-gray-200 bg-white shadow-lg max-h-56 overflow-y-auto">
                {COUNTRIES.map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    onClick={() => {
                      setCountry(c)
                      setShowCountries(false)
                    }}
                    className="w-full px-4 py-2.5 flex items-center gap-2 text-gray-700 text-sm hover:bg-gray-50 text-left"
                  >
                    <Flag code={c.code} className="rounded-full w-5 h-5 object-cover" />
                    {c.name}
                  </button>
                ))}
              </div>
            )}
            <p className="text-gray-500 text-xs mt-2">Certifique-se de que este é seu país de residência permanente</p>
          </div>

          <input
            type="email"
            placeholder="E-mail"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
          <input
            type="password"
            placeholder="Senha"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />

          {/* Telefone */}
          <div className="flex items-stretch gap-2">
            <div className="flex items-center gap-2 px-3 rounded-md bg-white border border-gray-300 text-gray-800 text-[15px]">
              <Flag code={country.code} className="rounded-full w-5 h-5 object-cover" />
              {country.dial}
            </div>
            <input
              type="tel"
              placeholder="Número de telefone"
              value={phone}
              onChange={handlePhoneChange}
              className={`${inputClass} flex-1`}
            />
          </div>

          <p className="text-gray-500 text-sm text-center leading-relaxed">
            Ao criar uma conta, você aceita nossos{" "}
            <button type="button" onClick={() => setShowTerms(true)} className="text-blue-600 hover:underline">
              Termos e Condições
            </button>
            , a <span className="text-blue-600">Política de Privacidade</span> e confirma que você tem 18 anos de idade ou
            mais.
          </p>

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
                Criando conta...
              </>
            ) : (
              "Abrir uma conta grátis"
            )}
          </button>

          <p className="text-center text-gray-500 text-sm pt-2">
            Já tem uma conta?{" "}
            <Link href="/auth/login" className="font-semibold text-blue-600 hover:underline">
              Entrar
            </Link>
          </p>
        </form>
      </main>
    </div>
  )
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="min-h-screen w-full bg-white" />}>
      <SignUpForm />
    </Suspense>
  )
}
