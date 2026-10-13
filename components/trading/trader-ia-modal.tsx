"use client"

import { useState, useCallback } from "react"
import { X, Loader2, CheckCircle, Sparkles, Lock } from "lucide-react"

interface TraderIAModalProps {
  isOpen: boolean
  onClose: () => void
  onActivate: () => void
}

type Step = "code" | "searching" | "found" | "select" | "activating" | "success"

export function TraderIAModal({ isOpen, onClose, onActivate }: TraderIAModalProps) {
  const [step, setStep] = useState<Step>("code")
  const [code, setCode] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleValidateCode = useCallback(async () => {
    if (!code.trim()) {
      setError("Digite o código de acesso")
      return
    }

    setIsLoading(true)
    setError("")

    try {
      const response = await fetch("/api/trader-ia/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      })

      const contentType = response.headers.get("content-type")
      if (!response.ok || !contentType?.includes("application/json")) {
        setError("Erro ao validar código. Tente novamente.")
        setIsLoading(false)
        return
      }

      const data = await response.json()

      if (!data.success) {
        setError(data.error || "Código inválido")
        setIsLoading(false)
        return
      }

      // Animation: Searching IA...
      setStep("searching")
      setIsLoading(false)

      setTimeout(() => {
        // Animation: IA found
        setStep("found")

        setTimeout(() => {
          // Show IA selection
          setStep("select")
        }, 1500)
      }, 2500)
    } catch {
      setError("Erro ao validar código. Tente novamente.")
      setIsLoading(false)
    }
  }, [code])

  const handleSelectIA = useCallback(() => {
    setStep("activating")

    setTimeout(() => {
      setStep("success")

      setTimeout(() => {
        onActivate()
        handleClose()
      }, 1500)
    }, 1500)
  }, [onActivate])

  const handleClose = useCallback(() => {
    setStep("code")
    setCode("")
    setError("")
    setIsLoading(false)
    onClose()
  }, [onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal */}
      <div
        className="relative w-full max-w-md rounded-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-300"
        style={{ backgroundColor: "#0f1419" }}
      >
        {/* Header */}
        <div className="relative p-4 border-b border-white/10">
          <div className="flex items-center justify-center gap-2">
            <Sparkles className="w-5 h-5 text-[#EF4444]" />
            <h2 className="text-white font-bold text-lg">Trader IA</h2>
          </div>
          <button
            onClick={handleClose}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Step: Code Input */}
          {step === "code" && (
            <div className="space-y-4">
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-[#EF4444]/20 flex items-center justify-center">
                  <Lock className="w-8 h-8 text-[#EF4444]" />
                </div>
                <p className="text-white/70 text-sm">Digite o código de acesso para ativar o Trader IA</p>
              </div>

              <input
                type="text"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value)
                  setError("")
                }}
                placeholder="Digite o código..."
                className="w-full px-4 py-3 bg-[#1a1f2e] border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-[#EF4444] transition"
              />

              {error && <p className="text-red-500 text-sm text-center">{error}</p>}

              <button
                onClick={handleValidateCode}
                disabled={isLoading}
                className="w-full py-3 bg-gradient-to-r from-[#EF4444] to-[#DC2626] hover:from-[#F87171] hover:to-[#EF4444] text-white font-bold rounded-xl transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Validando...
                  </>
                ) : (
                  "Entrar / Ativar IA"
                )}
              </button>
            </div>
          )}

          {/* Step: Searching */}
          {step === "searching" && (
            <div className="text-center py-8">
              <div className="w-20 h-20 mx-auto mb-6 relative">
                <div className="absolute inset-0 rounded-full border-4 border-[#EF4444]/20" />
                <div className="absolute inset-0 rounded-full border-4 border-[#EF4444] border-t-transparent animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-[#EF4444] animate-pulse" />
                </div>
              </div>
              <p className="text-white font-medium text-lg animate-pulse">Procurando IA...</p>
            </div>
          )}

          {/* Step: Found */}
          {step === "found" && (
            <div className="text-center py-8">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[#f97316]/20 flex items-center justify-center animate-in zoom-in duration-500">
                <CheckCircle className="w-12 h-12 text-[#f97316]" />
              </div>
              <p className="text-[#f97316] font-bold text-lg">IA encontrada com sucesso!</p>
            </div>
          )}

          {/* Step: Select IA */}
          {step === "select" && (
            <div className="space-y-4">
              <p className="text-center text-white/70 text-sm mb-4">Selecione a IA para ativar:</p>

              <button
                onClick={handleSelectIA}
                className="w-full p-4 bg-[#1a1f2e] hover:bg-[#252b3b] border border-[#EF4444]/30 hover:border-[#EF4444] rounded-xl transition group"
              >
                <div className="flex items-center gap-4">
                  <img
                    src="https://i.postimg.cc/PJ42cJjf/IMG-7295.png"
                    alt="Supra Indicador"
                    className="w-14 h-14 rounded-full object-cover"
                  />
                  <div className="flex-1 text-left">
                    <img
                      src="https://i.postimg.cc/cLQrNnzv/IMG-7296.png"
                      alt="Supra Indicador Logo"
                      className="h-6 object-contain mb-1"
                    />
                    <p className="text-white/50 text-xs">Inteligência Artificial para Trading</p>
                  </div>
                  <div className="w-8 h-8 rounded-full bg-[#EF4444]/20 flex items-center justify-center group-hover:bg-[#EF4444] transition">
                    <Sparkles className="w-4 h-4 text-[#EF4444] group-hover:text-white transition" />
                  </div>
                </div>
              </button>
            </div>
          )}

          {/* Step: Activating */}
          {step === "activating" && (
            <div className="text-center py-8">
              <div className="w-20 h-20 mx-auto mb-6 relative">
                <div className="absolute inset-0 rounded-full border-4 border-[#EF4444]/20" />
                <div className="absolute inset-0 rounded-full border-4 border-[#EF4444] border-t-transparent animate-spin" />
                <img
                  src="https://i.postimg.cc/PJ42cJjf/IMG-7295.png"
                  alt="Supra"
                  className="absolute inset-2 rounded-full object-cover"
                />
              </div>
              <p className="text-white font-medium text-lg animate-pulse">Ativando Supra Indicador...</p>
            </div>
          )}

          {/* Step: Success */}
          {step === "success" && (
            <div className="text-center py-8">
              <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[#f97316]/20 flex items-center justify-center animate-in zoom-in duration-500">
                <CheckCircle className="w-12 h-12 text-[#f97316]" />
              </div>
              <p className="text-[#f97316] font-bold text-lg">IA executada com sucesso!</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
