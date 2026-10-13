"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { CalendarDays, HelpCircle, Loader2 } from "lucide-react"
import type { AffiliateProfile } from "./types"

const COUNTRIES = [
  { code: "BR", name: "Brasil" },
  { code: "PT", name: "Portugal" },
  { code: "AR", name: "Argentina" },
  { code: "CL", name: "Chile" },
  { code: "CO", name: "Colômbia" },
  { code: "MX", name: "México" },
  { code: "PY", name: "Paraguai" },
  { code: "UY", name: "Uruguai" },
  { code: "AO", name: "Angola" },
  { code: "MZ", name: "Moçambique" },
]

const ACCOUNT_TYPES: Record<string, string> = {
  individual: "Indivíduo",
  company: "Empresa",
}

const fieldClass =
  "h-12 w-full rounded-lg border border-gray-300 bg-white px-4 text-[15px] text-gray-900 outline-none placeholder:text-gray-400 focus:border-emerald-500"

const readOnlyClass = "h-12 w-full rounded-lg bg-gray-100 px-4 text-[15px] leading-[3rem] text-gray-700"

export function SectionProfile() {
  const [profile, setProfile] = useState<AffiliateProfile | null>(null)
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [nickname, setNickname] = useState("")
  const [country, setCountry] = useState("BR")
  const [birthDate, setBirthDate] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState<{ type: "ok" | "error"; text: string } | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/affiliate/profile")
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || "Erro ao carregar perfil")
        const data: AffiliateProfile = json.profile
        setProfile(data)
        setFirstName(data.first_name)
        setLastName(data.last_name)
        setNickname(data.nickname)
        setCountry(data.country || "BR")
        setBirthDate(data.birth_date || "")
      } catch (err) {
        setFeedback({ type: "error", text: err instanceof Error ? err.message : "Erro ao carregar perfil" })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving) return

    setSaving(true)
    setFeedback(null)

    try {
      const res = await fetch("/api/affiliate/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, nickname, country, birthDate }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Erro ao guardar alterações")
      setFeedback({ type: "ok", text: "Alterações guardadas com sucesso." })
    } catch (err) {
      setFeedback({ type: "error", text: err instanceof Error ? err.message : "Erro ao guardar alterações" })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-500" />
      </div>
    )
  }

  return (
    <div className="flex max-w-[660px] flex-col">
      <h1 className="text-[28px] font-semibold tracking-tight text-gray-900">Informações do perfil</h1>
      <p className="mt-1 text-[15px] text-gray-600">Edite seus dados pessoais e informações de contato</p>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <p className="text-[15px] text-gray-700">Email</p>
          <p className={readOnlyClass}>{profile?.email}</p>
          {profile?.email_confirmed && (
            <span className="w-fit rounded-md bg-emerald-50 px-2.5 py-1 text-sm font-medium text-emerald-700">
              Confirmado
            </span>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-[15px] text-gray-700">Tipo de conta</p>
          <p className={readOnlyClass}>{ACCOUNT_TYPES[profile?.account_type || "individual"] || "Indivíduo"}</p>
        </div>
      </div>

      <form onSubmit={save} className="mt-6 border-t border-gray-200 pt-6">
        <div className="grid gap-5 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label htmlFor="prof-first" className="text-[15px] text-gray-700">
              Nome <span className="text-gray-400">*</span>
            </label>
            <input
              id="prof-first"
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              disabled={saving}
              className={fieldClass}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="prof-last" className="text-[15px] text-gray-700">
              Sobrenome <span className="text-gray-400">*</span>
            </label>
            <input
              id="prof-last"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              disabled={saving}
              className={fieldClass}
            />
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-2">
          <label htmlFor="prof-nickname" className="flex items-center gap-1.5 text-[15px] text-gray-700">
            Apelido <span className="text-gray-400">*</span>
            <span title="Nome exibido nos rankings e competições">
              <HelpCircle className="h-4 w-4 text-gray-400" />
            </span>
          </label>
          <input
            id="prof-nickname"
            type="text"
            placeholder="Inserir apelido"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            disabled={saving}
            className={fieldClass}
          />
        </div>

        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <div className="flex flex-col gap-2">
            <label htmlFor="prof-country" className="text-[15px] text-gray-700">
              País de residência <span className="text-gray-400">*</span>
            </label>
            <select
              id="prof-country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              disabled={saving}
              className={fieldClass}
            >
              {COUNTRIES.map((item) => (
                <option key={item.code} value={item.code}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="prof-birth" className="text-[15px] text-gray-700">
              Data de nascimento
            </label>
            <div className="relative">
              <CalendarDays className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                id="prof-birth"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
                disabled={saving}
                className={`${fieldClass} pl-11`}
              />
            </div>
          </div>
        </div>

        {feedback && (
          <p
            className={`mt-5 rounded-lg px-3 py-2.5 text-sm ${
              feedback.type === "ok"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border border-red-200 bg-red-50 text-red-600"
            }`}
          >
            {feedback.text}
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="mt-5 flex h-12 items-center gap-2 rounded-lg bg-emerald-400 px-6 text-[15px] font-medium text-gray-900 transition-colors hover:bg-emerald-500 disabled:opacity-60"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Guardar alterações
        </button>
      </form>
    </div>
  )
}
