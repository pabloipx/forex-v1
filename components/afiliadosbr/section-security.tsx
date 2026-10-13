"use client"

import type React from "react"

import { useCallback, useEffect, useState } from "react"
import { ArrowRight, Eye, EyeOff, Loader2, Lock, ShieldCheck } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

type Feedback = { type: "ok" | "error"; text: string } | null

const inputClass =
  "h-12 w-full rounded-lg border border-gray-300 bg-white px-4 pr-11 text-[15px] text-gray-900 outline-none placeholder:text-gray-400 focus:border-emerald-500"

function PasswordField({
  id,
  label,
  placeholder,
  value,
  onChange,
  disabled,
}: {
  id: string
  label: string
  placeholder: string
  value: string
  onChange: (value: string) => void
  disabled: boolean
}) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="flex max-w-[304px] flex-col gap-2">
      <label htmlFor={id} className="text-[15px] text-gray-700">
        {label} <span className="text-gray-400">*</span>
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          autoComplete="off"
          className={inputClass}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-600"
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
        >
          {visible ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
        </button>
      </div>
    </div>
  )
}

export function SectionSecurity({ email }: { email: string }) {
  const [mfaEnabled, setMfaEnabled] = useState(false)
  const [checkingMfa, setCheckingMfa] = useState(true)
  const [enrolling, setEnrolling] = useState(false)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [factorId, setFactorId] = useState<string | null>(null)
  const [totpCode, setTotpCode] = useState("")
  const [mfaFeedback, setMfaFeedback] = useState<Feedback>(null)

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordFeedback, setPasswordFeedback] = useState<Feedback>(null)

  const loadFactors = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase.auth.mfa.listFactors()
    setMfaEnabled(Boolean(data?.totp?.some((factor: { status: string }) => factor.status === "verified")))
    setCheckingMfa(false)
  }, [])

  useEffect(() => {
    loadFactors()
  }, [loadFactors])

  const startEnroll = async () => {
    setEnrolling(true)
    setMfaFeedback(null)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `URYN ${Date.now()}`,
      })
      if (error) throw error
      setFactorId(data.id)
      setQrCode(data.totp.qr_code)
    } catch (err) {
      setMfaFeedback({ type: "error", text: err instanceof Error ? err.message : "Erro ao iniciar a verificação" })
    } finally {
      setEnrolling(false)
    }
  }

  const confirmEnroll = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!factorId || totpCode.trim().length !== 6) {
      setMfaFeedback({ type: "error", text: "Informe o código de 6 dígitos do aplicativo" })
      return
    }

    setEnrolling(true)
    setMfaFeedback(null)
    try {
      const supabase = createClient()
      const challenge = await supabase.auth.mfa.challenge({ factorId })
      if (challenge.error) throw challenge.error

      const verify = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code: totpCode.trim(),
      })
      if (verify.error) throw verify.error

      setQrCode(null)
      setFactorId(null)
      setTotpCode("")
      setMfaFeedback({ type: "ok", text: "Autenticação de dois fatores ativada." })
      await loadFactors()
    } catch (err) {
      setMfaFeedback({ type: "error", text: err instanceof Error ? err.message : "Código inválido" })
    } finally {
      setEnrolling(false)
    }
  }

  const disableMfa = async () => {
    setEnrolling(true)
    setMfaFeedback(null)
    try {
      const supabase = createClient()
      const { data } = await supabase.auth.mfa.listFactors()
      const verified = data?.totp?.find((factor: { id: string; status: string }) => factor.status === "verified")
      if (verified) {
        const { error } = await supabase.auth.mfa.unenroll({ factorId: verified.id })
        if (error) throw error
      }
      setMfaFeedback({ type: "ok", text: "Autenticação de dois fatores desativada." })
      await loadFactors()
    } catch (err) {
      setMfaFeedback({ type: "error", text: err instanceof Error ? err.message : "Erro ao desativar" })
    } finally {
      setEnrolling(false)
    }
  }

  const updatePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (savingPassword) return

    if (!currentPassword) {
      setPasswordFeedback({ type: "error", text: "Insira a senha atual" })
      return
    }
    if (newPassword.length < 8) {
      setPasswordFeedback({ type: "error", text: "A nova senha deve ter pelo menos 8 caracteres" })
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordFeedback({ type: "error", text: "As senhas não coincidem" })
      return
    }
    if (newPassword === currentPassword) {
      setPasswordFeedback({ type: "error", text: "A nova senha deve ser diferente da atual" })
      return
    }

    setSavingPassword(true)
    setPasswordFeedback(null)

    try {
      const supabase = createClient()
      const reauth = await supabase.auth.signInWithPassword({ email, password: currentPassword })
      if (reauth.error) {
        setPasswordFeedback({ type: "error", text: "A senha atual está incorreta" })
        return
      }

      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error

      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setPasswordFeedback({ type: "ok", text: "Senha atualizada com sucesso." })
    } catch (err) {
      setPasswordFeedback({ type: "error", text: err instanceof Error ? err.message : "Erro ao atualizar a senha" })
    } finally {
      setSavingPassword(false)
    }
  }

  const feedbackClass = (feedback: NonNullable<Feedback>) =>
    feedback.type === "ok"
      ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
      : "border border-red-200 bg-red-50 text-red-600"

  return (
    <div className="flex max-w-[960px] flex-col">
      <h1 className="text-[28px] font-semibold tracking-tight text-gray-900">Segurança</h1>
      <p className="mt-1 text-[15px] text-gray-600">
        Melhore o grau de segurança da sua conta com ferramentas de proteção adicionais
      </p>

      <div className="mt-6 border-t border-gray-200 pt-6">
        <h2 className="text-[19px] font-medium text-gray-900">Autenticação de dois fatores</h2>
        <p className="mt-1 text-[15px] text-gray-600">Configure uma etapa de verificação adicional usando um código QR</p>

        <div className="mt-5 flex items-center gap-4">
          <span
            className={`flex h-11 w-11 items-center justify-center rounded-full ${
              mfaEnabled ? "bg-emerald-50" : "bg-gray-100"
            }`}
          >
            {mfaEnabled ? (
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
            ) : (
              <Lock className="h-5 w-5 text-gray-500" />
            )}
          </span>
          <div className="text-[15px]">
            {checkingMfa ? (
              <p className="text-gray-500">Verificando...</p>
            ) : (
              <>
                <p className="font-medium text-gray-900">{mfaEnabled ? "Ativada" : "Desativada"}</p>
                <p className="text-sm text-gray-500">
                  {mfaEnabled ? "Sua conta está protegida" : "A segurança da sua conta está em risco"}
                </p>
              </>
            )}
          </div>
        </div>

        {mfaFeedback && (
          <p className={`mt-4 max-w-[420px] rounded-lg px-3 py-2.5 text-sm ${feedbackClass(mfaFeedback)}`}>
            {mfaFeedback.text}
          </p>
        )}

        {qrCode ? (
          <form onSubmit={confirmEnroll} className="mt-5 flex flex-col gap-4">
            <div className="w-fit rounded-xl border border-gray-200 bg-white p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrCode || "/placeholder.svg"} alt="Código QR para autenticação de dois fatores" className="h-40 w-40" />
            </div>
            <p className="max-w-[420px] text-[15px] text-gray-600">
              Escaneie o código com o Google Authenticator ou outro aplicativo TOTP e insira o código gerado.
            </p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ""))}
              className="h-12 w-[180px] rounded-lg border border-gray-300 bg-white px-4 text-center text-[17px] tracking-[0.3em] text-gray-900 outline-none focus:border-emerald-500"
            />
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={enrolling}
                className="flex h-12 items-center gap-2 rounded-lg bg-emerald-400 px-6 text-[15px] font-medium text-gray-900 transition-colors hover:bg-emerald-500 disabled:opacity-60"
              >
                {enrolling && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirmar código
              </button>
              <button
                type="button"
                onClick={() => {
                  setQrCode(null)
                  setFactorId(null)
                  setTotpCode("")
                }}
                className="h-12 rounded-lg px-4 text-[15px] text-gray-600 transition-colors hover:text-gray-900"
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={mfaEnabled ? disableMfa : startEnroll}
            disabled={enrolling || checkingMfa}
            className={`mt-5 flex h-12 items-center gap-2 rounded-lg px-6 text-[15px] font-medium transition-colors disabled:opacity-60 ${
              mfaEnabled
                ? "border border-gray-300 text-gray-700 hover:bg-gray-50"
                : "bg-emerald-400 text-gray-900 hover:bg-emerald-500"
            }`}
          >
            {enrolling && <Loader2 className="h-4 w-4 animate-spin" />}
            {mfaEnabled ? "Desativar" : "Ativar"}
            {!mfaEnabled && !enrolling && <ArrowRight className="h-4 w-4" />}
          </button>
        )}
      </div>

      <form onSubmit={updatePassword} className="mt-8 border-t border-gray-200 pt-6">
        <h2 className="text-[19px] font-medium text-gray-900">Alterar senha</h2>
        <p className="mt-1 text-[15px] text-gray-600">Insira sua senha atual para alterá-la</p>

        <div className="mt-5 flex flex-col gap-4">
          <PasswordField
            id="sec-current"
            label="Senha atual"
            placeholder="Insira a senha atual"
            value={currentPassword}
            onChange={setCurrentPassword}
            disabled={savingPassword}
          />
          <PasswordField
            id="sec-new"
            label="Nova senha"
            placeholder="Insira a nova senha"
            value={newPassword}
            onChange={setNewPassword}
            disabled={savingPassword}
          />
          <PasswordField
            id="sec-confirm"
            label="Confirmar nova senha"
            placeholder="Insira a nova senha"
            value={confirmPassword}
            onChange={setConfirmPassword}
            disabled={savingPassword}
          />
        </div>

        {passwordFeedback && (
          <p className={`mt-4 max-w-[420px] rounded-lg px-3 py-2.5 text-sm ${feedbackClass(passwordFeedback)}`}>
            {passwordFeedback.text}
          </p>
        )}

        <button
          type="submit"
          disabled={savingPassword}
          className="mt-5 flex h-12 items-center gap-2 rounded-lg bg-emerald-400 px-6 text-[15px] font-medium text-gray-900 transition-colors hover:bg-emerald-500 disabled:opacity-60"
        >
          {savingPassword && <Loader2 className="h-4 w-4 animate-spin" />}
          Atualizar senha
        </button>
      </form>
    </div>
  )
}
