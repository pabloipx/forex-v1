"use client"

import { useEffect, useState } from "react"
import { TrendingUp, TrendingDown } from "lucide-react"

/**
 * Animacao de resultado da operacao no estilo Avalon.
 *
 * Um card central entra com um "pop" elastico sobre um brilho radial, mostra o badge do
 * resultado com aneis de energia se expandindo e o valor deslizando de baixo. No ganho sobem
 * moedas douradas; na perda o card da uma tremida curta. Perto do fim da exibicao o card sai
 * subindo, entao o desaparecimento nao e seco.
 *
 * O componente controla apenas a propria animacao de saida — quem monta/desmonta continua
 * sendo a pagina, que ja limpa o estado depois de `durationMs`.
 */

// Posicoes/tempos fixos (nao aleatorios) para as moedas, garantindo animacao identica
// em qualquer render e evitando divergencia entre servidor e cliente.
const COINS = [
  { left: "8%", delay: "0ms", duration: "1500ms", size: 14 },
  { left: "20%", delay: "180ms", duration: "1700ms", size: 10 },
  { left: "33%", delay: "80ms", duration: "1400ms", size: 12 },
  { left: "46%", delay: "320ms", duration: "1600ms", size: 16 },
  { left: "58%", delay: "120ms", duration: "1450ms", size: 11 },
  { left: "71%", delay: "260ms", duration: "1650ms", size: 13 },
  { left: "84%", delay: "40ms", duration: "1550ms", size: 10 },
  { left: "93%", delay: "400ms", duration: "1500ms", size: 12 },
]

export function TradeResultOverlay({
  type,
  amount,
  durationMs = 3000,
}: {
  type: "win" | "loss"
  amount: number
  durationMs?: number
}) {
  const [leaving, setLeaving] = useState(false)
  const isWin = type === "win"

  // Dispara a animacao de saida um pouco antes de a pagina remover o componente,
  // para o card sair subindo em vez de simplesmente desaparecer.
  useEffect(() => {
    const exitAt = Math.max(durationMs - 460, 0)
    const timer = setTimeout(() => setLeaving(true), exitAt)
    return () => clearTimeout(timer)
  }, [durationMs])

  const accent = isWin ? "#22c55e" : "#ef4444"
  const formatted = amount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center px-4"
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">
        {isWin ? `Operação vencedora, lucro de R$ ${formatted}` : `Operação perdida, prejuízo de R$ ${formatted}`}
      </span>

      <div className={leaving ? "animate-result-out" : "animate-result-pop-in"}>
        <div className={isWin ? "" : "animate-result-shake"}>
          <div className="relative">
            {/* Brilho radial pulsando atras do card */}
            <div
              aria-hidden="true"
              className="animate-result-glow absolute -inset-16 rounded-full blur-3xl"
              style={{
                background: `radial-gradient(circle, ${accent}55 0%, ${accent}18 45%, transparent 72%)`,
              }}
            />

            {/* Card do resultado */}
            <div
              className="relative flex min-w-[264px] flex-col items-center gap-4 rounded-3xl border px-8 py-7 backdrop-blur-xl sm:min-w-[300px]"
              style={{
                background: "linear-gradient(165deg, rgba(18,24,38,0.96) 0%, rgba(11,15,20,0.97) 100%)",
                borderColor: `${accent}66`,
                boxShadow: `0 0 0 1px ${accent}22, 0 18px 60px -12px ${accent}70, 0 8px 24px rgba(0,0,0,0.6)`,
              }}
            >
              {/* Badge com aneis de energia se expandindo */}
              <div className="relative flex h-16 w-16 items-center justify-center">
                <span
                  aria-hidden="true"
                  className="animate-result-ring absolute inset-0 rounded-full border-2"
                  style={{ borderColor: `${accent}88` }}
                />
                <span
                  aria-hidden="true"
                  className="animate-result-ring absolute inset-0 rounded-full border-2"
                  style={{ borderColor: `${accent}55`, animationDelay: "700ms" }}
                />
                <span
                  className="animate-result-badge relative flex h-16 w-16 items-center justify-center rounded-full"
                  style={{
                    background: `linear-gradient(145deg, ${accent} 0%, ${isWin ? "#15803d" : "#b91c1c"} 100%)`,
                    boxShadow: `0 8px 24px -4px ${accent}aa`,
                  }}
                >
                  {isWin ? (
                    <TrendingUp className="h-8 w-8 text-white" strokeWidth={2.5} />
                  ) : (
                    <TrendingDown className="h-8 w-8 text-white" strokeWidth={2.5} />
                  )}
                </span>
              </div>

              {/* Valor e rotulo */}
              <div className="animate-result-amount flex flex-col items-center gap-1">
                <p
                  className="text-4xl font-extrabold tabular-nums tracking-tight sm:text-5xl"
                  style={{ color: accent, textShadow: `0 0 28px ${accent}80` }}
                >
                  {isWin ? "+" : "-"}R$ {formatted}
                </p>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/55">
                  {isWin ? "Operação vencedora" : "Operação perdida"}
                </p>
              </div>

              {/* Linha de destaque na base do card */}
              <div
                aria-hidden="true"
                className="absolute inset-x-8 bottom-0 h-px"
                style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)` }}
              />
            </div>

            {/* Moedas subindo na frente do card — apenas no ganho */}
            {isWin && (
              <div aria-hidden="true" className="absolute -inset-x-10 bottom-2 z-10 h-px">
                {COINS.map((coin, i) => (
                  <span
                    key={i}
                    className="animate-result-coin absolute bottom-0 block rounded-full"
                    style={{
                      left: coin.left,
                      width: coin.size,
                      height: coin.size,
                      animationDelay: coin.delay,
                      animationDuration: coin.duration,
                      background: "linear-gradient(150deg, #fef3c7 0%, #fbbf24 45%, #d97706 100%)",
                      boxShadow:
                        "inset 0 0 0 1.5px rgba(255,255,255,0.6), 0 0 12px rgba(251,191,36,0.9), 0 2px 6px rgba(0,0,0,0.4)",
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
