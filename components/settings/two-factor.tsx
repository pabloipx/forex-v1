"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  ChevronLeft,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  Copy,
  Check,
  Trash2,
  Smartphone,
  KeyRound,
  ScanLine,
  Lock,
} from "lucide-react"
import QRCode from "qrcode"

interface Props {
  onBack: () => void
}

type Factor = { id: string; friendly_name?: string | null; status: string }

export function TwoFactor({ onBack }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [factors, setFactors] = useState<Factor[]>([])
  const [error, setError] = useState<string | null>(null)

  // Fluxo de inscrição (enroll)
  const [enrolling, setEnrolling] = useState(false)
  const [starting, setStarting] = useState(false)
  const [qrImage, setQrImage] = useState<string | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [factorId, setFactorId] = useState<string | null>(null)
  const [code, setCode] = useState("")
  const [verifying, setVerifying] = useState(false)
  const [copied, setCopied] = useState(false)

  const activeFactor = factors.find((f) => f.status === "verified")

  const loadFactors = async () => {
    setLoading(true)
    const { data, error } = await supabase.auth.mfa.listFactors()
    if (error) setError(error.message)
    else setFactors((data?.totp || []) as Factor[])
    setLoading(false)
  }

  useEffect(() => {
    loadFactors()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const startEnroll = async () => {
    setError(null)
    setStarting(true)
    // Limpa fatores nao verificados que possam ter sobrado de tentativas anteriores.
    const { data: list } = await supabase.auth.mfa.listFactors()
    for (const f of list?.totp || []) {
      if (f.status !== "verified") await supabase.auth.mfa.unenroll({ factorId: f.id })
    }
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" })
    if (error) {
      setError(error.message)
      setStarting(false)
      return
    }
    setFactorId(data.id)
    setSecret(data.totp.secret)
    // Gera o QR Code a partir da URI otpauth:// (garante leitura por qualquer app autenticador).
    try {
      const uri = data.totp.uri
      const img = await QRCode.toDataURL(uri, {
        width: 320,
        margin: 1,
        color: { dark: "#0B0F14", light: "#ffffff" },
        errorCorrectionLevel: "M",
      })
      setQrImage(img)
    } catch {
      // Fallback: usa o QR retornado pelo Supabase se a geracao local falhar.
      setQrImage(data.totp.qr_code)
    }
    setEnrolling(true)
    setStarting(false)
  }

  const cancelEnroll = () => {
    setEnrolling(false)
    setQrImage(null)
    setSecret(null)
    setFactorId(null)
    setCode("")
    setError(null)
  }

  const verifyEnroll = async () => {
    if (!factorId || code.length < 6) return
    setVerifying(true)
    setError(null)
    const { data: challenge, error: cErr } = await supabase.auth.mfa.challenge({ factorId })
    if (cErr) {
      setError(cErr.message)
      setVerifying(false)
      return
    }
    const { error: vErr } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: code.trim(),
    })
    if (vErr) {
      setError("Código inválido. Verifique o app autenticador e tente novamente.")
      setVerifying(false)
      return
    }
    // Sucesso: reseta o fluxo e recarrega a lista.
    cancelEnroll()
    setVerifying(false)
    await loadFactors()
  }

  const disable = async (id: string) => {
    setError(null)
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id })
    if (error) setError(error.message)
    else await loadFactors()
  }

  const copySecret = () => {
    if (!secret) return
    navigator.clipboard.writeText(secret)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="min-h-screen bg-[#0B0F14]">
      <div className="sticky top-0 z-10 px-4 py-4 flex items-center gap-3 border-b border-[#1F2933] bg-[#0B0F14]/95 backdrop-blur">
        <button onClick={onBack} className="p-2 -ml-2" aria-label="Voltar">
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>
        <h1 className="text-xl font-bold text-white">Verificação em duas etapas</h1>
      </div>

      <div className="px-4 py-6 max-w-xl mx-auto space-y-5">
        {error && (
          <div className="flex items-start gap-2 text-sm p-3 rounded-lg text-red-400 bg-red-500/10 border border-red-500/20">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-6 h-6 text-[#f97316] animate-spin" />
          </div>
        ) : activeFactor ? (
          // ===== 2FA ATIVO =====
          <div className="space-y-4">
            <div className="relative overflow-hidden rounded-2xl border border-[#1b5e20]/40 bg-gradient-to-br from-[#0f2318] to-[#0B0F14] p-6">
              <div className="flex flex-col items-center text-center gap-3">
                <div className="w-16 h-16 rounded-full bg-[#00E676]/15 flex items-center justify-center ring-4 ring-[#00E676]/10">
                  <ShieldCheck className="w-8 h-8 text-[#00E676]" />
                </div>
                <div>
                  <p className="text-white font-bold text-lg">Proteção ativada</p>
                  <p className="text-sm text-[#9CA3AF] mt-1 text-balance">
                    Sua conta está protegida. A cada login será solicitado um código do seu app autenticador.
                  </p>
                </div>
                <span className="mt-1 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#00E676]/10 text-[#00E676] text-xs font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#00E676] animate-pulse" />
                  Autenticador conectado
                </span>
              </div>
            </div>

            <div className="rounded-xl border border-[#1F2933] bg-[#121826] divide-y divide-[#1F2933]">
              <div className="flex items-center gap-3 p-4">
                <KeyRound className="w-5 h-5 text-[#f97316] shrink-0" />
                <div>
                  <p className="text-white text-sm font-medium">App autenticador</p>
                  <p className="text-xs text-[#6B7280]">Código TOTP de 6 dígitos, renovado a cada 30 segundos</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-4">
                <Lock className="w-5 h-5 text-[#f97316] shrink-0" />
                <div>
                  <p className="text-white text-sm font-medium">Login protegido</p>
                  <p className="text-xs text-[#6B7280]">Ninguém entra sem a senha e o código do seu dispositivo</p>
                </div>
              </div>
            </div>

            <button
              onClick={() => disable(activeFactor.id)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors font-medium"
            >
              <Trash2 className="w-4 h-4" />
              Desativar verificação em duas etapas
            </button>
          </div>
        ) : enrolling && qrImage ? (
          // ===== FLUXO DE ATIVAÇÃO =====
          <div className="space-y-6">
            {/* Etapa 1 - Escanear */}
            <div className="rounded-2xl border border-[#1F2933] bg-[#121826] p-5">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-7 h-7 rounded-full bg-[#f97316] text-white text-sm font-bold flex items-center justify-center shrink-0">
                  1
                </span>
                <div className="flex items-center gap-2">
                  <ScanLine className="w-4 h-4 text-[#f97316]" />
                  <p className="text-white font-semibold">Escaneie o QR Code</p>
                </div>
              </div>
              <p className="text-sm text-[#9CA3AF] mb-4 leading-relaxed">
                Abra o <span className="text-white">Google Authenticator</span>, <span className="text-white">Authy</span>{" "}
                ou outro app autenticador e aponte a câmera para o código abaixo.
              </p>
              <div className="flex justify-center">
                <div className="relative bg-white p-3 rounded-2xl shadow-lg">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrImage || "/placeholder.svg"} alt="QR Code para autenticação" className="w-52 h-52 block" />
                  {/* Cantos decorativos do "scanner" */}
                  <span className="pointer-events-none absolute left-1 top-1 w-6 h-6 border-l-2 border-t-2 border-[#f97316] rounded-tl-lg" />
                  <span className="pointer-events-none absolute right-1 top-1 w-6 h-6 border-r-2 border-t-2 border-[#f97316] rounded-tr-lg" />
                  <span className="pointer-events-none absolute left-1 bottom-1 w-6 h-6 border-l-2 border-b-2 border-[#f97316] rounded-bl-lg" />
                  <span className="pointer-events-none absolute right-1 bottom-1 w-6 h-6 border-r-2 border-b-2 border-[#f97316] rounded-br-lg" />
                </div>
              </div>

              {secret && (
                <div className="mt-5">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-px flex-1 bg-[#1F2933]" />
                    <span className="text-xs text-[#6B7280]">ou insira a chave manualmente</span>
                    <div className="h-px flex-1 bg-[#1F2933]" />
                  </div>
                  <button
                    onClick={copySecret}
                    className="w-full flex items-center justify-between gap-2 p-3 rounded-lg bg-[#0B0F14] border border-[#1F2933] hover:border-[#f97316]/50 transition-colors text-left group"
                  >
                    <code className="text-sm text-white break-all font-mono tracking-wide">{secret}</code>
                    {copied ? (
                      <span className="flex items-center gap-1 text-[#00E676] text-xs shrink-0">
                        <Check className="w-4 h-4" /> Copiado
                      </span>
                    ) : (
                      <Copy className="w-4 h-4 text-[#6B7280] group-hover:text-white shrink-0" />
                    )}
                  </button>
                </div>
              )}
            </div>

            {/* Etapa 2 - Confirmar código */}
            <div className="rounded-2xl border border-[#1F2933] bg-[#121826] p-5">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-7 h-7 rounded-full bg-[#f97316] text-white text-sm font-bold flex items-center justify-center shrink-0">
                  2
                </span>
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-[#f97316]" />
                  <p className="text-white font-semibold">Digite o código gerado</p>
                </div>
              </div>
              <p className="text-sm text-[#9CA3AF] mb-4 leading-relaxed">
                Insira o código de 6 dígitos que aparece no seu app para confirmar a ativação.
              </p>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoFocus
                placeholder="000000"
                className="w-full py-3.5 px-4 rounded-xl text-white text-center text-3xl tracking-[0.4em] font-mono bg-[#0B0F14] border border-[#1F2933] focus:border-[#f97316] outline-none placeholder:text-[#2A3441]"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={cancelEnroll}
                className="flex-1 py-3 rounded-xl text-white bg-[#1A2332] hover:bg-[#243040] transition-colors font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={verifyEnroll}
                disabled={code.length < 6 || verifying}
                className="flex-1 py-3 rounded-xl text-white bg-[#f97316] hover:bg-[#c2410c] transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {verifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                Ativar proteção
              </button>
            </div>
          </div>
        ) : (
          // ===== ESTADO INICIAL (DESATIVADO) =====
          <div className="space-y-5">
            <div className="relative overflow-hidden rounded-2xl border border-[#1F2933] bg-gradient-to-br from-[#1A1030] to-[#0B0F14] p-6">
              <div className="flex flex-col items-center text-center gap-3">
                <div className="w-16 h-16 rounded-2xl bg-[#f97316]/15 flex items-center justify-center ring-4 ring-[#f97316]/10">
                  <ShieldAlert className="w-8 h-8 text-[#f97316]" />
                </div>
                <div>
                  <p className="text-white font-bold text-lg text-balance">Adicione uma camada extra de segurança</p>
                  <p className="text-sm text-[#9CA3AF] mt-1 text-balance">
                    Proteja sua conta exigindo um código único do seu celular, além da senha, sempre que fizer login.
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {[
                { icon: Smartphone, title: "Use qualquer autenticador", desc: "Google Authenticator, Authy, Microsoft Authenticator e outros" },
                { icon: ScanLine, title: "Configuração rápida", desc: "Escaneie um QR Code e confirme com um código de 6 dígitos" },
                { icon: Lock, title: "Proteção contra invasões", desc: "Mesmo que descubram sua senha, não conseguem entrar" },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-3 p-4 rounded-xl bg-[#121826] border border-[#1F2933]">
                  <div className="w-9 h-9 rounded-lg bg-[#f97316]/15 flex items-center justify-center shrink-0">
                    <item.icon className="w-5 h-5 text-[#f97316]" />
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">{item.title}</p>
                    <p className="text-xs text-[#6B7280] mt-0.5 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={startEnroll}
              disabled={starting}
              className="w-full py-3.5 rounded-xl text-white bg-[#f97316] hover:bg-[#c2410c] transition-colors font-semibold disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              Ativar verificação em duas etapas
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
