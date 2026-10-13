"use client"

import { useEffect, useState } from "react"
import { Check, Loader2, Tag, X } from "lucide-react"

export interface PromoPreview {
  code: string
  description: string | null
  bonusAmount: number
  rolloverRequired: number
  totalCredit: number
}

interface PromoCodeInputProps {
  /** Valor do deposito em reais, usado para calcular o bonus. */
  amount: number
  /** Informa ao pai o codigo aprovado (ou null), para enviar junto ao gerar o PIX. */
  onApplied: (code: string | null) => void
}

const brl = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0)

/**
 * Campo de codigo promocional da tela de deposito.
 *
 * O que aparece aqui e apenas uma PREVIA: o bonus e recalculado no servidor ao gerar o PIX e de
 * novo quando o deposito e confirmado, entao alterar valores por aqui nao aumenta o bonus.
 */
export function PromoCodeInput({ amount, onApplied }: PromoCodeInputProps) {
  const [code, setCode] = useState("")
  const [applied, setApplied] = useState<PromoPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Se o usuario mudar o valor depois de aplicar, o bonus previsto muda (ou o codigo deixa de
  // valer pelo minimo). Revalidamos para nao exibir um numero desatualizado.
  useEffect(() => {
    if (!applied) return

    let cancelled = false
    const revalidate = async () => {
      try {
        const res = await fetch("/api/promo/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: applied.code, amount }),
        })
        const data = await res.json()
        if (cancelled) return

        if (data.valid) {
          setApplied(data)
          setError("")
        } else {
          setApplied(null)
          onApplied(null)
          setError(data.error || "O código não vale mais para este valor.")
        }
      } catch {
        // Falha de rede: mantem o estado atual, o servidor decide na hora de gerar o PIX.
      }
    }

    const timer = setTimeout(revalidate, 500)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount])

  const handleApply = async () => {
    if (!code.trim()) return

    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/promo/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, amount }),
      })
      const data = await res.json()

      if (!res.ok || !data.valid) {
        setApplied(null)
        onApplied(null)
        setError(data.error || "Código inválido.")
        return
      }

      setApplied(data)
      onApplied(data.code)
    } catch {
      setError("Não foi possível validar o código agora.")
    } finally {
      setLoading(false)
    }
  }

  const handleRemove = () => {
    setApplied(null)
    setCode("")
    setError("")
    onApplied(null)
  }

  if (applied) {
    return (
      <div className="p-4 rounded-xl border-2 border-green-500/60 bg-[#121826]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-green-500/20">
              <Check className="w-3.5 h-3.5 text-green-400" />
            </span>
            <div className="min-w-0">
              <p className="text-green-400 text-sm font-medium">
                Código <span className="font-mono">{applied.code}</span> aplicado
              </p>
              {applied.description && <p className="text-[#9CA3AF] text-xs mt-1">{applied.description}</p>}
              <p className="text-white text-sm mt-2">
                Bônus de <span className="font-semibold text-green-400">{brl(applied.bonusAmount)}</span> — você recebe{" "}
                {brl(applied.totalCredit)}
              </p>
              {applied.rolloverRequired > 0 && (
                <p className="text-[#9CA3AF] text-xs mt-1">
                  Para sacar o bônus, é preciso movimentar {brl(applied.rolloverRequired)} em operações.
                </p>
              )}
            </div>
          </div>
          <button
            onClick={handleRemove}
            className="text-[#9CA3AF] hover:text-white shrink-0"
            aria-label="Remover código promocional"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 rounded-xl border border-[#1E2633] bg-[#121826]">
      <label htmlFor="promo-code" className="flex items-center gap-2 text-[#9CA3AF] text-sm mb-2">
        <Tag className="w-4 h-4" />
        Código promocional (opcional)
      </label>
      <div className="flex gap-2">
        <input
          id="promo-code"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase())
            setError("")
          }}
          onKeyDown={(e) => {
            // isComposing evita enviar enquanto um teclado de IME confirma a digitacao.
            if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) {
              e.preventDefault()
              handleApply()
            }
          }}
          placeholder="Digite seu código"
          className="flex-1 px-3 py-2.5 rounded-lg bg-[#0B0F14] border border-[#1E2633] text-white font-mono placeholder:font-sans placeholder:text-[#6B7280] focus:outline-none focus:border-[#f97316]"
        />
        <button
          onClick={handleApply}
          disabled={loading || !code.trim()}
          className="px-4 py-2.5 rounded-lg bg-[#1A1F2E] text-white font-medium hover:bg-[#232A3A] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Aplicar"}
        </button>
      </div>
      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
    </div>
  )
}
