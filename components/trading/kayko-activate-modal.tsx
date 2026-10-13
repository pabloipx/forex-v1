"use client"

import { useState, useCallback } from "react"
import { X, Loader2, Lock, CheckCircle, Eye, EyeOff } from "lucide-react"

interface KaykoActivateModalProps {
  isOpen: boolean
  onClose: () => void
  onActivated: () => void
}

type Step = "password" | "activating" | "success"

const ACCENT = "#22d3ee"

export function KaykoActivateModal({ isOpen, onClose, onActivated }: KaykoActivateModalProps) {
  const [step, setStep] = useState<Step>("password")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const reset = useCallback(() => {
    setStep("password")
    setPassword("")
    setShowPassword(false)
    setError("")
    setIsLoading(false)
  }, [])

  const handleClose = useCallback(() => {
    reset()
    onClose()
  }, [reset, onClose])

  const handleActivate = useCallback(async () => {
    if (!password.trim()) {
      setError("Digite a senha do robô")
      return
    }
    setIsLoading(true)
    setError("")
    try {
      const res = await fetch("/api/kayko/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: password.trim() }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.success) {
        setError(data?.error || "Senha incorreta")
        setIsLoading(false)
        return
      }
      setIsLoading(false)
      setStep("activating")
      window.setTimeout(() => {
        setStep("success")
        window.setTimeout(() => {
          onActivated()
          handleClose()
        }, 1400)
      }, 1800)
    } catch {
      setError("Erro ao validar. Tente novamente.")
      setIsLoading(false)
    }
  }, [password, onActivated, handleClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={handleClose} />

      <div
        className="relative w-full max-w-sm rounded-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-300 border border-white/5"
        style={{ backgroundColor: "#0a0e13" }}
      >
        {/* Header */}
        <div className="relative p-5 border-b border-white/5" style={{ background: `linear-gradient(135deg, ${ACCENT}1f 0%, #0a0e13 70%)` }}>
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-2xl overflow-hidden ring-2"
              style={{ boxShadow: `0 0 16px ${ACCENT}55`, borderColor: ACCENT }}
            >
              <img src="/images/kayko-robot.png" alt="Robô KAYKO" className="w-full h-full object-cover" />
            </div>
            <div>
              <h2 className="text-white font-black text-lg tracking-wide">
                ROBÔ <span style={{ color: ACCENT }}>KAYKO</span>
              </h2>
              <p className="text-white/40 text-xs">Analisador de entradas</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="absolute right-4 top-4 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition flex items-center justify-center"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6">
          {step === "password" && (
            <div className="space-y-4">
              <div className="text-center mb-2">
                <div
                  className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: `${ACCENT}22` }}
                >
                  <Lock className="w-8 h-8" style={{ color: ACCENT }} />
                </div>
                <p className="text-white/70 text-sm">Digite a senha do robô para ativá-lo na tela de trade.</p>
              </div>

              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    setError("")
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.nativeEvent.isComposing) handleActivate()
                  }}
                  placeholder="Senha do robô"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="w-full px-4 py-3 pr-12 text-base bg-[#121826] border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none transition"
                  style={{ caretColor: ACCENT }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              {error && <p className="text-[#EF4444] text-sm text-center">{error}</p>}

              <button
                onClick={handleActivate}
                disabled={isLoading}
                className="w-full py-3.5 text-[#04121a] font-bold rounded-xl transition disabled:opacity-60 flex items-center justify-center gap-2 active:scale-[0.98]"
                style={{ background: `linear-gradient(90deg, ${ACCENT}, #0891b2)`, boxShadow: `0 8px 24px ${ACCENT}44` }}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Validando...
                  </>
                ) : (
                  "Ativar robô"
                )}
              </button>
            </div>
          )}

          {step === "activating" && (
            <div className="text-center py-8">
              <div className="w-20 h-20 mx-auto mb-6 relative">
                <div className="absolute inset-0 rounded-full border-4" style={{ borderColor: `${ACCENT}33` }} />
                <div className="absolute inset-0 rounded-full border-4 border-t-transparent animate-spin" style={{ borderColor: ACCENT, borderTopColor: "transparent" }} />
                <img src="/images/kayko-robot.png" alt="KAYKO" className="absolute inset-2 rounded-full object-cover" />
              </div>
              <p className="text-white font-medium text-lg animate-pulse">Ativando o robô KAYKO...</p>
            </div>
          )}

          {step === "success" && (
            <div className="text-center py-8">
              <div
                className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center animate-in zoom-in duration-500"
                style={{ backgroundColor: `${ACCENT}22` }}
              >
                <CheckCircle className="w-12 h-12" style={{ color: ACCENT }} />
              </div>
              <p className="font-bold text-lg" style={{ color: ACCENT }}>
                Robô ativado com sucesso!
              </p>
              <p className="text-white/50 text-sm mt-1">Abra a tela de trade para ver o robô.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
