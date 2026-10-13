"use client"

import type React from "react"
import { useState, useRef, useEffect, useCallback } from "react"
import { X, Search, Loader2, Volume2, TrendingUp, TrendingDown, Zap } from "lucide-react"

interface Signal {
  id: string
  type: "CALL" | "PUT"
  asset: string
  assetName: string
  time: string
  confidence: number
  timestamp: number
}

interface TraderIAWatermarkProps {
  isActive: boolean
  onSignalGenerated?: (signal: Signal) => void
}

export function TraderIAWatermark({ isActive, onSignalGenerated }: TraderIAWatermarkProps) {
  const [position, setPosition] = useState({ x: 20, y: 200 })
  const [isDragging, setIsDragging] = useState(false)
  const [showPopup, setShowPopup] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [currentSignal, setCurrentSignal] = useState<Signal | null>(null)
  const dragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number } | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const clickTimeRef = useRef<number>(0)

  const ALLOWED_SIGNAL_ASSETS = [
    { symbol: "EUR/USD-OTC", name: "EUR/USD OTC" },
    { symbol: "GBP/USD-OTC", name: "GBP/USD OTC" },
    { symbol: "USD/JPY-OTC", name: "USD/JPY OTC" },
    { symbol: "AUD/USD-OTC", name: "AUD/USD OTC" },
    { symbol: "BTC/USD-OTC", name: "BTC/USD OTC" },
  ]

  useEffect(() => {
    if (typeof window !== "undefined") {
      audioRef.current = new Audio("/notification.mp3")
      audioRef.current.volume = 0.5
    }
  }, [])

  const playAlertSound = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0
      audioRef.current.play().catch(() => {
        try {
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
          const oscillator = audioContext.createOscillator()
          const gainNode = audioContext.createGain()
          oscillator.connect(gainNode)
          gainNode.connect(audioContext.destination)
          oscillator.frequency.value = 800
          oscillator.type = "sine"
          gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5)
          oscillator.start(audioContext.currentTime)
          oscillator.stop(audioContext.currentTime + 0.5)
        } catch {
          // Silent fail
        }
      })
    }
  }, [])

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".popup-content")) return
    clickTimeRef.current = Date.now()
    setIsDragging(true)
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: position.x,
      initialY: position.y,
    }
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest(".popup-content")) return
    clickTimeRef.current = Date.now()
    const touch = e.touches[0]
    setIsDragging(true)
    dragRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      initialX: position.x,
      initialY: position.y,
    }
  }

  const handleClick = () => {
    const clickDuration = Date.now() - clickTimeRef.current
    if (clickDuration < 200 && !isDragging) {
      setShowPopup(true)
    }
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !dragRef.current) return
      const deltaX = e.clientX - dragRef.current.startX
      const deltaY = e.clientY - dragRef.current.startY
      setPosition({
        x: Math.max(0, Math.min(window.innerWidth - 60, dragRef.current.initialX + deltaX)),
        y: Math.max(0, Math.min(window.innerHeight - 60, dragRef.current.initialY + deltaY)),
      })
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging || !dragRef.current) return
      const touch = e.touches[0]
      const deltaX = touch.clientX - dragRef.current.startX
      const deltaY = touch.clientY - dragRef.current.startY
      setPosition({
        x: Math.max(0, Math.min(window.innerWidth - 60, dragRef.current.initialX + deltaX)),
        y: Math.max(0, Math.min(window.innerHeight - 60, dragRef.current.initialY + deltaY)),
      })
    }

    const handleEnd = () => {
      setIsDragging(false)
      dragRef.current = null
    }

    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove)
      window.addEventListener("mouseup", handleEnd)
      window.addEventListener("touchmove", handleTouchMove)
      window.addEventListener("touchend", handleEnd)
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      window.removeEventListener("mouseup", handleEnd)
      window.removeEventListener("touchmove", handleTouchMove)
      window.removeEventListener("touchend", handleEnd)
    }
  }, [isDragging])

  const generateSignal = useCallback(() => {
    setIsSearching(true)
    setCurrentSignal(null)

    setTimeout(() => {
      const randomAsset = ALLOWED_SIGNAL_ASSETS[Math.floor(Math.random() * ALLOWED_SIGNAL_ASSETS.length)]
      const type = Math.random() > 0.5 ? "CALL" : "PUT"

      const now = new Date()
      const secondsToAdd = Math.floor(Math.random() * 90) + 30
      now.setSeconds(now.getSeconds() + secondsToAdd)
      const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })

      const signal: Signal = {
        id: Date.now().toString(),
        type,
        asset: randomAsset.symbol,
        assetName: randomAsset.name,
        time: timeStr,
        confidence: Math.floor(Math.random() * 15) + 85,
        timestamp: now.getTime(),
      }

      setCurrentSignal(signal)
      setIsSearching(false)
      playAlertSound()

      if (onSignalGenerated) {
        onSignalGenerated(signal)
      }
    }, 3000)
  }, [onSignalGenerated, playAlertSound])

  if (!isActive) return null

  return (
    <>
      {/* Floating Watermark */}
      <div
        className="fixed z-[90] cursor-grab active:cursor-grabbing touch-none"
        style={{ left: position.x, top: position.y }}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
        onClick={handleClick}
      >
        <div className="relative">
          <div className="relative w-14 h-14 rounded-full overflow-hidden border-2 border-[#EF4444] shadow-lg shadow-[#EF4444]/30">
            <img
              src="https://i.postimg.cc/PJ42cJjf/IMG-7295.png"
              alt="Supra IA"
              className="w-full h-full object-cover"
              draggable={false}
            />
          </div>
          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-[#f97316] rounded-full border-2 border-[#0f1419] flex items-center justify-center">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
          </div>
        </div>
      </div>

      {/* Popup Modal */}
      {showPopup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowPopup(false)} />

          <div
            className="popup-content relative w-full max-w-sm rounded-3xl overflow-hidden animate-in fade-in zoom-in-95 duration-300 shadow-2xl"
            style={{ backgroundColor: "#0a0e13" }}
          >
            <div className="relative p-5 bg-gradient-to-br from-[#1a1f26] via-[#0f1419] to-[#0a0e13] border-b border-white/5">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-14 h-14 rounded-2xl overflow-hidden ring-2 ring-[#EF4444]/50 shadow-lg shadow-[#EF4444]/20">
                    <img
                      src="https://i.postimg.cc/PJ42cJjf/IMG-7295.png"
                      alt="Supra IA"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#f97316] rounded-full border-2 border-[#0a0e13] flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  </div>
                </div>
                <div className="flex-1">
                  <img
                    src="https://i.postimg.cc/cLQrNnzv/IMG-7296.png"
                    alt="Supra Indicador"
                    className="h-6 object-contain"
                  />
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[#f97316] text-xs font-medium flex items-center gap-1.5">
                      <span className="w-2 h-2 bg-[#f97316] rounded-full animate-pulse" />
                      Online
                    </span>
                    <span className="text-white/30 text-xs">•</span>
                    <span className="text-white/40 text-xs flex items-center gap-1">
                      <Zap className="w-3 h-3" />
                      IA Ativa
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowPopup(false)}
                className="absolute right-4 top-4 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4">
              <button
                onClick={generateSignal}
                disabled={isSearching}
                className="w-full py-4 bg-gradient-to-r from-[#EF4444] to-[#DC2626] hover:from-[#F87171] hover:to-[#EF4444] text-white font-bold rounded-2xl transition-all duration-300 disabled:opacity-70 flex items-center justify-center gap-3 shadow-lg shadow-[#EF4444]/30 hover:shadow-[#EF4444]/50 hover:scale-[1.02] active:scale-[0.98]"
              >
                {isSearching ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Procurando sinal...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-5 h-5" />
                    <span>Procurar Sinal</span>
                  </>
                )}
              </button>

              {currentSignal && !isSearching && (
                <div
                  className={`relative p-5 rounded-2xl border animate-in slide-in-from-bottom-4 duration-500 overflow-hidden ${
                    currentSignal.type === "CALL"
                      ? "bg-gradient-to-br from-[#f97316]/20 via-[#f97316]/10 to-transparent border-[#f97316]/50"
                      : "bg-gradient-to-br from-[#EF4444]/20 via-[#EF4444]/10 to-transparent border-[#EF4444]/50"
                  }`}
                >
                  {/* Glow effect */}
                  <div
                    className={`absolute inset-0 opacity-30 blur-2xl ${
                      currentSignal.type === "CALL" ? "bg-[#f97316]" : "bg-[#EF4444]"
                    }`}
                    style={{ transform: "scale(0.5)", transformOrigin: "center" }}
                  />

                  <div className="relative">
                    {/* Header row */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center ${
                            currentSignal.type === "CALL" ? "bg-[#f97316]/20" : "bg-[#EF4444]/20"
                          }`}
                        >
                          <Volume2
                            className={`w-4 h-4 ${currentSignal.type === "CALL" ? "text-[#f97316]" : "text-[#EF4444]"}`}
                          />
                        </div>
                        <span className="text-white/60 text-sm font-medium">Novo Sinal</span>
                      </div>
                      <div
                        className={`px-3 py-1 rounded-full text-xs font-bold ${
                          currentSignal.type === "CALL" ? "bg-[#f97316] text-white" : "bg-[#EF4444] text-white"
                        }`}
                      >
                        {currentSignal.confidence}%
                      </div>
                    </div>

                    {/* Asset info */}
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white font-bold text-xl">{currentSignal.assetName}</p>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center gap-2 justify-end">
                          {currentSignal.type === "CALL" ? (
                            <TrendingUp className="w-6 h-6 text-[#f97316]" />
                          ) : (
                            <TrendingDown className="w-6 h-6 text-[#EF4444]" />
                          )}
                          <p
                            className={`font-black text-2xl ${
                              currentSignal.type === "CALL" ? "text-[#f97316]" : "text-[#EF4444]"
                            }`}
                          >
                            {currentSignal.type === "CALL" ? "COMPRA" : "VENDA"}
                          </p>
                        </div>
                        <p className="text-white font-mono text-lg mt-1 bg-white/5 px-3 py-1 rounded-lg inline-block">
                          {currentSignal.time}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="text-center">
                <p className="text-white/50 text-xs flex items-center justify-center gap-1.5">
                  <Zap className="w-3 h-3" />
                  Sinais baseados no sistema de API da corretora
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
