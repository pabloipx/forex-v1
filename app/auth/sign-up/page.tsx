"use client"

import type React from "react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import Image from "next/image"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useEffect, Suspense } from "react"
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Eye,
  EyeOff,
  Gift,
  Loader2,
  MapPin,
  X,
} from "lucide-react"
import { recordDeviceSession } from "@/lib/device-session"
import {
  PHONE_RULES,
  formatNationalPhone,
  phoneMaxLength,
  validateSignupProfile,
  type CountryCode,
  type SignupFieldErrors,
} from "@/lib/signup-validation"
import { AUTH_ACCENT, AUTH_ACCENT_TEXT, AUTH_INPUT, AUTH_LABEL, AuthLayout } from "@/components/auth/auth-layout"

const COUNTRIES: { name: string; code: CountryCode; dial: string }[] = [
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
      alt=""
      width={24}
      height={24}
      className={className}
      unoptimized
    />
  )
}

function TermsModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true">
      <div className="relative w-full max-w-lg max-h-[85vh] rounded-2xl overflow-hidden flex flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-800">Termos e Condições de Uso</h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 transition-colors" aria-label="Fechar">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 text-gray-600 text-sm leading-relaxed flex flex-col gap-3">
          <p className="text-xs text-gray-400">Última atualização: Janeiro de 2026</p>
          <p>
            Ao acessar, cadastrar-se ou utilizar a plataforma Kryptobit, o usuário declara que leu, compreendeu e
            concorda integralmente com os presentes Termos e Condições.
          </p>
          <h3 className="text-gray-800 font-semibold pt-1">1. Elegibilidade</h3>
          <p>A utilização é exclusiva para pessoas maiores de 18 anos.</p>
          <h3 className="text-gray-800 font-semibold pt-1">2. Cadastro</h3>
          <p>O usuário compromete-se a fornecer informações verdadeiras e completas.</p>
          <h3 className="text-gray-800 font-semibold pt-1">3. Riscos</h3>
          <p>Operações financeiras envolvem riscos e podem resultar em perdas. A Kryptobit não garante lucros.</p>
        </div>
        <div className="p-4 border-t border-gray-200">
          <button onClick={onClose} className={`w-full h-12 rounded-full font-semibold transition-colors ${AUTH_ACCENT}`}>
            Li e Entendi
          </button>
        </div>
      </div>
    </div>
  )
}

function SignUpForm() {
  const [step, setStep] = useState<1 | 2>(1)
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [country, setCountry] = useState(COUNTRIES[0])
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [phone, setPhone] = useState("")
  const [acceptedTerms, setAcceptedTerms] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [showTerms, setShowTerms] = useState(false)
  const [showCountries, setShowCountries] = useState(false)
  const [showReferral, setShowReferral] = useState(false)
  const [referralCode, setReferralCode] = useState("")
  const [referralSubId, setReferralSubId] = useState("")
  const [fieldErrors, setFieldErrors] = useState<SignupFieldErrors>({})
  const [touched, setTouched] = useState<Record<keyof SignupFieldErrors, boolean>>({
    firstName: false,
    lastName: false,
    phone: false,
  })
  const router = useRouter()

  const liveErrors = validateSignupProfile({ firstName, lastName, country: country.code, phone })
  const visibleError = (field: keyof SignupFieldErrors) =>
    touched[field] ? (liveErrors[field] ?? fieldErrors[field]) : undefined
  const markTouched = (field: keyof SignupFieldErrors) => setTouched((t) => ({ ...t, [field]: true }))
  const searchParams = useSearchParams()

  useEffect(() => {
    const ref = searchParams.get("ref")
    if (ref) {
      setReferralCode(ref.toUpperCase())
      setShowReferral(true)
    }
    // subid identifica a campanha do afiliado (?ref=CODE&subid=instagram)
    const subid = searchParams.get("subid") ?? searchParams.get("sub_id")
    if (subid) setReferralSubId(subid.slice(0, 64))
  }, [searchParams])

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(e.target.value.replace(/\D/g, "").slice(0, phoneMaxLength(country.code)))
    setFieldErrors((f) => ({ ...f, phone: undefined }))
  }

  const handleContinue = (e: React.FormEvent) => {
    e.preventDefault()
    if (!acceptedTerms) {
      setError("Você precisa aceitar os Termos de Serviço para continuar")
      return
    }
    setError(null)
    setStep(2)
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched({ firstName: true, lastName: true, phone: true })
    if (Object.keys(liveErrors).length > 0) {
      setError("Corrija os campos destacados para continuar")
      return
    }
    const supabase = createClient()
    setIsLoading(true)
    setError(null)

    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres")
      setIsLoading(false)
      return
    }

    try {
      const res = await fetch("/api/auth/sign-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          firstName,
          lastName,
          country: country.code,
          phone,
          referralCode,
          referralSubId,
        }),
      })

      const result = await res.json()
      if (!res.ok) {
        if (result.fieldErrors) setFieldErrors(result.fieldErrors)
        throw new Error(result.error || "Erro ao criar conta")
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) {
        throw new Error("Conta criada, mas houve erro ao entrar. Tente fazer login.")
      }

      await recordDeviceSession()

      setSuccess(true)
      setTimeout(() => router.push("/futures"), 2000)
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : "Erro ao criar conta"
      setError(errMsg.includes("already registered") ? "Este e-mail já está cadastrado" : errMsg)
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
        <div className="text-center px-6 animate-in fade-in zoom-in duration-500">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center bg-blue-100">
            <CheckCircle2 className={`w-12 h-12 ${AUTH_ACCENT_TEXT}`} />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Conta criada com sucesso!</h1>
          <p className="text-gray-500 mb-6">Você será redirecionado para a plataforma...</p>
          <div className={`flex items-center justify-center gap-2 ${AUTH_ACCENT_TEXT}`}>
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Entrando...</span>
          </div>
        </div>
      </div>
    )
  }

  const inputClass = AUTH_INPUT
  const labelClass = AUTH_LABEL

  return (
    <AuthLayout
      overlay={showTerms && <TermsModal onClose={() => setShowTerms(false)} />}
      switchHref="/auth/login"
      switchLabel="Acesse agora"
      title={
        <>
          {step === 2 && (
            <button
              type="button"
              onClick={() => {
                setStep(1)
                setError(null)
              }}
              className="p-1 -ml-1 rounded-md text-gray-500 hover:bg-gray-100"
              aria-label="Voltar"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          )}
          <h1 className="text-xl font-semibold text-gray-900">Criar conta</h1>
        </>
      }
    >
            {step === 1 ? (
              <form onSubmit={handleContinue} className="flex flex-col gap-4 px-6 pt-7 pb-12">
                <div className="flex flex-col gap-3">
                  <label className={labelClass} id="country-label">
                    Onde você mora?
                  </label>
                  <div className="relative">
                    <button
                      type="button"
                      aria-labelledby="country-label"
                      aria-expanded={showCountries}
                      onClick={() => setShowCountries((v) => !v)}
                      className="w-full h-12 px-4 rounded-lg bg-gray-100 flex items-center justify-between text-gray-900 text-base"
                    >
                      <span className="flex items-center gap-2.5">
                        <Flag code={country.code} className="rounded-full w-6 h-6 object-cover" />
                        {country.name}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-gray-500">
                        <MapPin className="w-3.5 h-3.5" />
                        Local
                        <ChevronDown className="w-3.5 h-3.5" />
                      </span>
                    </button>
                    {showCountries && (
                      <ul
                        role="listbox"
                        className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-56 overflow-y-auto py-1"
                      >
                        {COUNTRIES.map((c) => (
                          <li key={c.code}>
                            <button
                              type="button"
                              role="option"
                              aria-selected={c.code === country.code}
                              onClick={() => {
                                setCountry(c)
                                setShowCountries(false)
                              }}
                              className="w-full px-4 py-2.5 flex items-center gap-2.5 text-gray-700 text-sm hover:bg-gray-50 text-left"
                            >
                              <Flag code={c.code} className="rounded-full w-5 h-5 object-cover" />
                              {c.name}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                <label className="flex items-start gap-2 text-xs leading-relaxed text-gray-500">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-blue-600"
                  />
                  <span>
                    Ao selecionar &quot;Criar uma conta&quot;, você concorda com{" "}
                    <button type="button" onClick={() => setShowTerms(true)} className={`${AUTH_ACCENT_TEXT} hover:underline`}>
                      Termos de Serviço
                    </button>{" "}
                    e <span className={AUTH_ACCENT_TEXT}>Política de Privacidade</span> e confirma ter 18 anos ou mais.
                  </span>
                </label>

                {error && <ErrorBox message={error} />}

                <button
                  type="submit"
                  className={`mt-2 w-full h-12 rounded-full font-semibold text-base flex items-center justify-center gap-2 transition-colors ${AUTH_ACCENT}`}
                >
                  <Gift className="w-4 h-4" />
                  Criar uma conta
                </button>
              </form>
            ) : (
              <form onSubmit={handleSignUp} className="flex flex-col gap-4 px-6 pt-7 pb-10">
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-2">
                    <label htmlFor="firstName" className={labelClass}>
                      Nome
                    </label>
                    <input
                      id="firstName"
                      type="text"
                      placeholder="Nome"
                      required
                      autoComplete="given-name"
                      maxLength={60}
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      onBlur={() => markTouched("firstName")}
                      aria-invalid={Boolean(visibleError("firstName"))}
                      aria-describedby={visibleError("firstName") ? "firstName-error" : undefined}
                      className={`${inputClass} ${visibleError("firstName") ? FIELD_INVALID : ""}`}
                    />
                    <FieldError id="firstName-error" message={visibleError("firstName")} />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label htmlFor="lastName" className={labelClass}>
                      Sobrenome
                    </label>
                    <input
                      id="lastName"
                      type="text"
                      placeholder="Sobrenome"
                      required
                      autoComplete="family-name"
                      maxLength={60}
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      onBlur={() => markTouched("lastName")}
                      aria-invalid={Boolean(visibleError("lastName"))}
                      aria-describedby={visibleError("lastName") ? "lastName-error" : undefined}
                      className={`${inputClass} ${visibleError("lastName") ? FIELD_INVALID : ""}`}
                    />
                    <FieldError id="lastName-error" message={visibleError("lastName")} />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="email" className={labelClass}>
                    E-mail
                  </label>
                  <input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label htmlFor="password" className={labelClass}>
                    Senha
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Mínimo de 6 caracteres"
                      required
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={`${inputClass} pr-11`}
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

                <div className="flex flex-col gap-2">
                  <label htmlFor="phone" className={labelClass}>
                    Número de celular
                  </label>
                  <div className="flex items-stretch gap-2">
                    <div className="flex items-center gap-2 px-3 rounded-lg bg-gray-100 text-gray-800 text-[15px]">
                      <Flag code={country.code} className="rounded-full w-5 h-5 object-cover" />
                      {country.dial}
                    </div>
                    <input
                      id="phone"
                      type="tel"
                      inputMode="numeric"
                      required
                      placeholder={PHONE_RULES[country.code].example}
                      autoComplete="tel-national"
                      value={formatNationalPhone(country.code, phone)}
                      onChange={handlePhoneChange}
                      onBlur={() => markTouched("phone")}
                      aria-invalid={Boolean(visibleError("phone"))}
                      aria-describedby={visibleError("phone") ? "phone-error" : undefined}
                      className={`${inputClass} flex-1 min-w-0 ${visibleError("phone") ? FIELD_INVALID : ""}`}
                    />
                  </div>
                  <FieldError id="phone-error" message={visibleError("phone")} />
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => setShowReferral((v) => !v)}
                    aria-expanded={showReferral}
                    className="flex items-center gap-1.5 self-start text-sm text-gray-500 hover:text-gray-700"
                  >
                    Código de indicação (opcional)
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showReferral ? "rotate-180" : ""}`} />
                  </button>
                  {showReferral && (
                    <input
                      type="text"
                      aria-label="Código de indicação"
                      placeholder="Código de indicação"
                      value={referralCode}
                      onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                      className={inputClass}
                    />
                  )}
                </div>

                {error && <ErrorBox message={error} />}

                <button
                  type="submit"
                  disabled={isLoading}
                  className={`mt-1 w-full h-12 rounded-full font-semibold text-base flex items-center justify-center gap-2 transition-colors disabled:opacity-70 ${AUTH_ACCENT}`}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Criando conta...
                    </>
                  ) : (
                    <>
                      <Gift className="w-4 h-4" />
                      Criar uma conta
                    </>
                  )}
                </button>
              </form>
            )}
    </AuthLayout>
  )
}

const FIELD_INVALID = "ring-1 ring-red-400 bg-red-50"

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} className="text-xs leading-snug text-red-600">
      {message}
    </p>
  )
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div role="alert" className="text-sm p-3 rounded-lg text-red-600 bg-red-50 border border-red-200">
      {message}
    </div>
  )
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<div className="min-h-screen w-full bg-[#f5f6fa]" />}>
      <SignUpForm />
    </Suspense>
  )
}
