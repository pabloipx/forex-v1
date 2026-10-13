"use client"

import { useEffect, useState } from "react"
import { Check } from "lucide-react"

const ANALYZE_STEPS = [
  "Lendo fluxo de ordens do par",
  "Calculando RSI e médias móveis",
  "Medindo volatilidade do período",
  "Identificando suporte e resistência",
  "Validando padrão de candle",
  "Confirmando sinal de entrada",
]

const RECOVER_STEPS = [
  "Revisando últimas entradas",
  "Recalibrando gestão de risco",
  "Filtrando sinais de baixa confiança",
  "Buscando tendência mais forte",
  "Reduzindo exposição por ciclo",
  "Preparando entrada de recuperação",
]

const VISIBLE = 3
const STEP_MS = 2200

export function AiAnalysisFeed({ active, recovering }: { active: boolean; recovering: boolean }) {
  const steps = recovering ? RECOVER_STEPS : ANALYZE_STEPS
  const [cursor, setCursor] = useState(0)
  const [confidence, setConfidence] = useState(72)

  useEffect(() => {
    setCursor(0)
  }, [recovering])

  useEffect(() => {
    if (!active) return
    const id = setInterval(() => {
      setCursor((c) => c + 1)
      setConfidence(68 + Math.round(Math.random() * 26))
    }, STEP_MS)
    return () => clearInterval(id)
  }, [active])

  const tone = recovering
    ? { text: "text-red-400", bg: "bg-red-400", soft: "bg-red-400/15", border: "border-red-400/25" }
    : { text: "text-lime-400", bg: "bg-lime-400", soft: "bg-lime-400/15", border: "border-lime-400/25" }

  const visible = Array.from({ length: VISIBLE }, (_, i) => {
    const index = cursor - (VISIBLE - 1) + i
    return { key: index, label: steps[((index % steps.length) + steps.length) % steps.length], current: i === VISIBLE - 1 }
  }).filter((s) => s.key >= 0)

  return (
    <div className={`mt-3 rounded-xl border ${tone.border} bg-background/60 p-3 backdrop-blur-sm`}>
      <div className="mb-2.5 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <span className={`h-1.5 w-1.5 rounded-full ${tone.bg} ${active ? "animate-pulse" : "opacity-40"}`} />
          IA analisando
        </span>
        <span
          className={`rounded-full border ${tone.border} ${tone.soft} px-2 py-0.5 text-[10px] font-semibold tabular-nums ${tone.text}`}
        >
          {active ? `Confiança ${confidence}%` : "Em espera"}
        </span>
      </div>

      <ul className="flex flex-col gap-1.5" aria-live="polite">
        {visible.map((s) => (
          <li
            key={s.key}
            className={`flex items-center gap-2 text-xs animate-ia-step-in ${
              s.current && active ? "text-foreground" : "text-muted-foreground"
            }`}
          >
            {s.current && active ? (
              <span
                className={`h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-t-transparent ${
                  recovering ? "border-red-400" : "border-lime-400"
                }`}
                aria-hidden="true"
              />
            ) : (
              <span
                className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full ${tone.soft}`}
                aria-hidden="true"
              >
                <Check className={`h-2.5 w-2.5 ${tone.text}`} strokeWidth={3} />
              </span>
            )}
            <span className="truncate">{s.label}</span>
            {s.current && active && <span className="animate-ia-dots text-muted-foreground" aria-hidden="true" />}
          </li>
        ))}
      </ul>

      <div className="relative mt-3 h-1 overflow-hidden rounded-full bg-secondary">
        {active && <span className={`absolute inset-y-0 w-1/3 rounded-full ${tone.bg} animate-ia-scan`} />}
      </div>
    </div>
  )
}
