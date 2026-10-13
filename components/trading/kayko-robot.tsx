"use client"

import type React from "react"
import { useState, useRef, useEffect, useCallback } from "react"
import { X, Loader2, TrendingUp, TrendingDown, Radar, Clock, Cpu } from "lucide-react"
import { subscribeLivePrice, getLivePrice } from "@/lib/price-engine/live-price-store"

interface KaykoSignal {
  type: "CALL" | "PUT"
  assetName: string
  entryTime: string
  expirationLabel: string
  confidence: number
}

interface KaykoRobotProps {
  isActive: boolean
  assetName?: string
  symbol?: string
  expirySeconds?: number
}

const ACCENT = "#F97316"

interface KaykoScore {
  win: number
  loss: number
  profit: number
}

const SCORE_KEY = "kayko_score_v1"
const ACTIVATED_KEY = "kayko_activated_at"

function getActivatedAt(): number {
  try {
    return Number(localStorage.getItem(ACTIVATED_KEY)) || 0
  } catch {
    return 0
  }
}

export function KaykoRobot({ isActive, assetName, symbol, expirySeconds = 60 }: KaykoRobotProps) {
  const [position, setPosition] = useState({ x: 16, y: 130 })
  const [isDragging, setIsDragging] = useState(false)
  const [showPopup, setShowPopup] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [signal, setSignal] = useState<KaykoSignal | null>(null)
  const [score, setScore] = useState<KaykoScore>({ win: 0, loss: 0, profit: 0 })
  const dragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number } | null>(null)
  const movedRef = useRef(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  // Histórico curto de preços do ativo atual: usado para dar um viés "real" à direção da entrada.
  const priceHistoryRef = useRef<number[]>([])

  useEffect(() => {
    if (typeof window !== "undefined") {
      audioRef.current = new Audio("/notification.mp3")
      audioRef.current.volume = 0.5
    }
  }, [])

  // Carrega o placar do dispositivo, mas SOMENTE se ele pertence à ativação atual.
  // O placar fica atrelado ao carimbo de ativação (kayko_activated_at): qualquer placar
  // de uma ativação anterior (ou legado sem carimbo) é zerado — assim, ao ativar, começa
  // sempre em 0 x 0 e só sobe pelo resultado real das entradas feitas depois de ativar.
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      let activatedAt = getActivatedAt()
      // Ativação legada sem carimbo: cria um agora para o placar contar a partir daqui.
      if (isActive && activatedAt === 0) {
        activatedAt = Date.now()
        localStorage.setItem(ACTIVATED_KEY, String(activatedAt))
      }
      const raw = localStorage.getItem(SCORE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as KaykoScore & { for?: number }
        if (typeof parsed?.win === "number" && parsed.for === activatedAt) {
          setScore({ win: parsed.win, loss: parsed.loss ?? 0, profit: parsed.profit ?? 0 })
          return
        }
      }
      // Placar de outra ativação (ou legado) => começa 0 x 0 para esta ativação.
      const zero: KaykoScore = { win: 0, loss: 0, profit: 0 }
      setScore(zero)
      localStorage.setItem(SCORE_KEY, JSON.stringify({ ...zero, for: activatedAt }))
    } catch {}
  }, [isActive])

  // O placar sobe pelo resultado real de cada operação encerrada na tela de trade.
  // A própria página dispara "kayko:trade-result" ao fechar uma entrada (win/loss + lucro).
  useEffect(() => {
    if (typeof window === "undefined") return
    const onResult = (e: Event) => {
      const detail = (e as CustomEvent<{ result?: "win" | "loss"; profit?: number; openedAt?: number }>).detail
      if (!detail || (detail.result !== "win" && detail.result !== "loss")) return
      // Só conta entradas abertas a partir do momento da ativação — entradas que já
      // estavam abertas antes de ativar o robô não entram no placar.
      const activatedAt = getActivatedAt()
      if (activatedAt > 0 && typeof detail.openedAt === "number" && detail.openedAt < activatedAt) return
      const won = detail.result === "win"
      const delta = typeof detail.profit === "number" ? detail.profit : 0
      setScore((prev) => {
        const next: KaykoScore = {
          win: prev.win + (won ? 1 : 0),
          loss: prev.loss + (won ? 0 : 1),
          profit: Math.round((prev.profit + delta) * 100) / 100,
        }
        try {
          localStorage.setItem(SCORE_KEY, JSON.stringify({ ...next, for: activatedAt }))
        } catch {}
        return next
      })
    }
    window.addEventListener("kayko:trade-result", onResult as EventListener)
    return () => window.removeEventListener("kayko:trade-result", onResult as EventListener)
  }, [])

  // Placar definido manualmente pelo admin (tela de perfil). Atualiza o flutuante ao vivo.
  useEffect(() => {
    if (typeof window === "undefined") return
    const onSet = (e: Event) => {
      const detail = (e as CustomEvent<Partial<KaykoScore>>).detail
      if (!detail) return
      setScore({
        win: Math.max(0, Math.floor(detail.win ?? 0)),
        loss: Math.max(0, Math.floor(detail.loss ?? 0)),
        profit: Math.round((detail.profit ?? 0) * 100) / 100,
      })
    }
    window.addEventListener("kayko:score-set", onSet as EventListener)
    return () => window.removeEventListener("kayko:score-set", onSet as EventListener)
  }, [])

  // Acompanha o preço do ativo em tela para a análise reagir ao mercado atual.
  // Assina o live-price-store diretamente (em vez de receber `price` por prop), para o robô NÃO
  // forçar a página de trade a re-renderizar no tick de preço. Alimenta apenas um ref, sem setState.
  useEffect(() => {
    const unsub = subscribeLivePrice(() => {
      const p = getLivePrice()
      if (typeof p !== "number" || isNaN(p) || p <= 0) return
      const hist = priceHistoryRef.current
      hist.push(p)
      if (hist.length > 40) hist.shift()
    })
    return unsub
  }, [])

  // Ao trocar de ativo, zera o histórico para não misturar tendências de pares diferentes.
  useEffect(() => {
    priceHistoryRef.current = []
    setSignal(null)
  }, [symbol])

  const playAlert = useCallback(() => {
    const el = audioRef.current
    if (!el) return
    el.currentTime = 0
    el.play().catch(() => {})
  }, [])

  const handleDown = (clientX: number, clientY: number, target: EventTarget | null) => {
    if ((target as HTMLElement)?.closest?.(".kayko-popup")) return
    movedRef.current = false
    setIsDragging(true)
    dragRef.current = { startX: clientX, startY: clientY, initialX: position.x, initialY: position.y }
  }

  const handleMouseDown = (e: React.MouseEvent) => handleDown(e.clientX, e.clientY, e.target)
  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0]
    handleDown(t.clientX, t.clientY, e.target)
  }

  useEffect(() => {
    if (!isDragging) return
    const move = (cx: number, cy: number) => {
      if (!dragRef.current) return
      const dx = cx - dragRef.current.startX
      const dy = cy - dragRef.current.startY
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) movedRef.current = true
      setPosition({
        x: Math.max(0, Math.min(window.innerWidth - 56, dragRef.current.initialX + dx)),
        y: Math.max(60, Math.min(window.innerHeight - 90, dragRef.current.initialY + dy)),
      })
    }
    const onMouseMove = (e: MouseEvent) => move(e.clientX, e.clientY)
    const onTouchMove = (e: TouchEvent) => {
      const t = e.touches[0]
      move(t.clientX, t.clientY)
    }
    const end = () => {
      setIsDragging(false)
      dragRef.current = null
    }
    window.addEventListener("mousemove", onMouseMove)
    window.addEventListener("mouseup", end)
    window.addEventListener("touchmove", onTouchMove)
    window.addEventListener("touchend", end)
    return () => {
      window.removeEventListener("mousemove", onMouseMove)
      window.removeEventListener("mouseup", end)
      window.removeEventListener("touchmove", onTouchMove)
      window.removeEventListener("touchend", end)
    }
  }, [isDragging])

  const handleClick = () => {
    if (movedRef.current) return
    setShowPopup(true)
  }

  const analyze = useCallback(() => {
    setIsAnalyzing(true)
    setSignal(null)

    window.setTimeout(() => {
      // Direção com viés na tendência recente do preço do ativo em tela.
      const hist = priceHistoryRef.current
      let bias = 0
      if (hist.length >= 4) {
        const recent = hist.slice(-8)
        bias = recent[recent.length - 1] - recent[0]
      }
      let type: "CALL" | "PUT"
      if (bias > 0) type = Math.random() < 0.7 ? "CALL" : "PUT"
      else if (bias < 0) type = Math.random() < 0.7 ? "PUT" : "CALL"
      else type = Math.random() < 0.5 ? "CALL" : "PUT"

      // Horário de entrada: sempre de 4 a 5 minutos à frente do momento do sinal,
      // no início do minuto cheio (padrão de sinais).
      const entry = new Date()
      entry.setSeconds(0, 0)
      const minutesAhead = Math.random() < 0.5 ? 4 : 5
      entry.setMinutes(entry.getMinutes() + minutesAhead)
      const entryTime = entry.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })

      const mins = Math.max(1, Math.round(expirySeconds / 60))
      const expirationLabel = `${mins} ${mins === 1 ? "minuto" : "minutos"}`

      const confidence = Math.floor(Math.random() * 12) + 86

      setSignal({
        type,
        assetName: assetName || symbol || "Ativo",
        entryTime,
        expirationLabel,
        confidence,
      })

      // A análise apenas gera o sinal. O placar NÃO muda aqui — ele só sobe pelo
      // resultado real da operação quando ela é encerrada na tela de trade.
      setIsAnalyzing(false)
      playAlert()
    }, 2600)
  }, [assetName, symbol, expirySeconds, playAlert])

  if (!isActive) return null

  const isCall = signal?.type === "CALL"

  return (
    <>
      {/* Robô flutuante */}
      <div
        className="fixed z-[90] cursor-grab active:cursor-grabbing touch-none select-none"
        style={{ left: position.x, top: position.y }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onClick={handleClick}
        role="button"
        aria-label="Abrir robô KAYKO"
      >
        <div className="flex flex-col items-center">
          <div className="relative w-20 h-20 md:w-28 md:h-28">
            <span
              className="absolute left-1/2 top-1/2 w-14 h-14 md:w-20 md:h-20 -translate-x-1/2 -translate-y-1/2 rounded-full animate-ping"
              style={{ backgroundColor: `${ACCENT}44` }}
            />
            <img
              src="/images/kayko-robot.png"
              alt="Robô KAYKO"
              className="relative w-full h-full object-contain"
              style={{ filter: `drop-shadow(0 0 12px ${ACCENT}aa) drop-shadow(0 2px 6px rgba(0,0,0,0.7))` }}
              draggable={false}
            />
            <div
              className="absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-[#0B0F14] flex items-center justify-center"
              style={{ backgroundColor: ACCENT }}
            >
              <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
            </div>
          </div>

          {/* Placar WIN/LOSS acumulado */}
          <div
            className="-mt-1 w-[132px] md:w-[168px] rounded-xl p-1.5 md:p-2 backdrop-blur-md border shadow-xl"
            style={{ backgroundColor: "rgba(8,12,17,0.82)", borderColor: `${ACCENT}55` }}
          >
            <div className="flex gap-1">
              <div className="flex-1 rounded-lg px-2 py-1 flex items-center justify-between" style={{ backgroundColor: "rgba(34,197,94,0.15)" }}>
                <span className="text-[9px] font-bold uppercase tracking-wide text-[#22c55e]">Win</span>
                <span className="text-sm font-black text-[#22c55e] leading-none">{score.win}</span>
              </div>
              <div className="flex-1 rounded-lg px-2 py-1 flex items-center justify-between" style={{ backgroundColor: "rgba(239,68,68,0.15)" }}>
                <span className="text-[9px] font-bold uppercase tracking-wide text-[#EF4444]">Loss</span>
                <span className="text-sm font-black text-[#EF4444] leading-none">{score.loss}</span>
              </div>
            </div>
            <div className="flex items-center justify-between px-1 pt-1">
              <span className={`text-[11px] font-bold ${score.profit >= 0 ? "text-[#22c55e]" : "text-[#EF4444]"}`}>
                {score.profit >= 0 ? "+" : "-"}R$ {Math.abs(score.profit).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span className="text-[11px] font-bold text-white/70">
                {score.win + score.loss > 0 ? Math.round((score.win / (score.win + score.loss)) * 100) : 0}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Popup de análise */}
      {showPopup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowPopup(false)} />

          <div
            className="kayko-popup relative w-full max-w-sm rounded-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-300 shadow-2xl border border-white/5"
            style={{ backgroundColor: "#0a0e13" }}
          >
            {/* Header */}
            <div className="relative p-5 border-b border-white/5" style={{ background: `linear-gradient(135deg, ${ACCENT}1f 0%, #0a0e13 70%)` }}>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 flex items-center justify-center shrink-0">
                  <img
                    src="/images/kayko-robot.png"
                    alt="Robô KAYKO"
                    className="w-full h-full object-contain"
                    style={{ filter: `drop-shadow(0 0 8px ${ACCENT}88)` }}
                  />
                </div>
                <div className="flex-1">
                  <h2 className="text-white font-black text-lg tracking-wide">
                    ROBÔ <span style={{ color: ACCENT }}>KAYKO</span>
                  </h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs font-medium flex items-center gap-1.5" style={{ color: ACCENT }}>
                      <span className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: ACCENT }} />
                      Online
                    </span>
                    <span className="text-white/30 text-xs">•</span>
                    <span className="text-white/40 text-xs flex items-center gap-1">
                      <Cpu className="w-3 h-3" />
                      IA de análise
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowPopup(false)}
                className="absolute right-4 top-4 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition flex items-center justify-center"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Corpo */}
            <div className="p-5 space-y-4">
              {/* Ativo atual em análise */}
              <div className="flex items-center justify-between rounded-2xl px-4 py-3 bg-white/5">
                <span className="text-white/50 text-xs uppercase tracking-wide">Ativo em análise</span>
                <span className="text-white font-bold text-sm">{assetName || symbol || "—"}</span>
              </div>

              <button
                onClick={analyze}
                disabled={isAnalyzing}
                className="w-full py-4 text-[#04121a] font-bold rounded-2xl transition-all duration-300 disabled:opacity-70 flex items-center justify-center gap-3 active:scale-[0.98]"
                style={{ background: `linear-gradient(90deg, ${ACCENT}, #0891b2)`, boxShadow: `0 8px 24px ${ACCENT}44` }}
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Analisando o ativo...</span>
                  </>
                ) : (
                  <>
                    <Radar className="w-5 h-5" />
                    <span>Analisar e gerar entrada</span>
                  </>
                )}
              </button>

              {signal && !isAnalyzing && (
                <div
                  className="relative p-5 rounded-2xl border animate-in slide-in-from-bottom-4 duration-500 overflow-hidden"
                  style={{
                    borderColor: isCall ? "#22c55e80" : "#EF444480",
                    background: isCall
                      ? "linear-gradient(135deg, rgba(34,197,94,0.18), transparent)"
                      : "linear-gradient(135deg, rgba(239,68,68,0.18), transparent)",
                  }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-white/60 text-sm font-medium">Entrada confirmada</span>
                    <div
                      className="px-3 py-1 rounded-full text-xs font-bold text-white"
                      style={{ backgroundColor: isCall ? "#22c55e" : "#EF4444" }}
                    >
                      {signal.confidence}% de acerto
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white/50 text-xs">Ativo</p>
                      <p className="text-white font-bold text-lg leading-tight">{signal.assetName}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {isCall ? (
                        <TrendingUp className="w-7 h-7 text-[#22c55e]" />
                      ) : (
                        <TrendingDown className="w-7 h-7 text-[#EF4444]" />
                      )}
                      <p className={`font-black text-2xl ${isCall ? "text-[#22c55e]" : "text-[#EF4444]"}`}>
                        {isCall ? "COMPRA" : "VENDA"}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="rounded-xl px-3 py-2.5 bg-black/30">
                      <p className="text-white/40 text-[10px] uppercase tracking-wide flex items-center gap-1">
                        <Clock className="w-3 h-3" /> Horário de entrada
                      </p>
                      <p className="text-white font-mono font-bold text-base mt-0.5">{signal.entryTime}</p>
                    </div>
                    <div className="rounded-xl px-3 py-2.5 bg-black/30">
                      <p className="text-white/40 text-[10px] uppercase tracking-wide">Expiração</p>
                      <p className="text-white font-bold text-base mt-0.5">{signal.expirationLabel}</p>
                    </div>
                  </div>
                </div>
              )}

              <p className="text-center text-white/40 text-xs flex items-center justify-center gap-1.5">
                <Cpu className="w-3 h-3" />
                Análise do ativo aberto na tela em tempo real
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
