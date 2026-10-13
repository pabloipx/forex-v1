"use client"

import type React from "react"
import { useEffect, useRef, useState, useCallback } from "react"
import type { OTCCandle } from "@/lib/price-engine/multi-asset-engine"

interface ActiveTradeEntry {
  id: string
  entryPrice: number
  direction: "CALL" | "PUT"
  expiryTime?: number
  symbol: string
}

interface LightweightChartProps {
  candles: OTCCandle[]
  currentCandle: OTCCandle | null
  currentPrice: number
  timeframe: number
  symbol: string
  entryPrice?: number
  direction?: "CALL" | "PUT"
  expiryTime?: number
  activeTrades?: ActiveTradeEntry[]
}

function formatPrice(price: number, symbol: string): string {
  if (symbol.includes("BTC")) return price.toFixed(2)
  if (symbol.includes("JPY")) return price.toFixed(3)
  return price.toFixed(5)
}

function formatSymbolName(symbol: string): string {
  return symbol
    .replace("_OTC", " OTC")
    .replace("USD", "/USD")
    .replace("EUR", "EUR")
    .replace("GBP", "GBP")
    .replace("AUD", "AUD")
    .replace("BTC", "BTC")
}

export function LightweightChart({
  candles,
  currentCandle,
  currentPrice,
  timeframe,
  symbol,
  entryPrice,
  direction,
  expiryTime,
  activeTrades = [],
}: LightweightChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [brasiliaTime, setBrasiliaTime] = useState("")

  const [viewState, setViewState] = useState({
    visibleCandles: 60,
    offset: 0,
  })

  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, offset: 0 })
  const [isAtLive, setIsAtLive] = useState(true)

  const allCandles = [...candles]
  if (currentCandle) {
    allCandles.push(currentCandle)
  }

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setDimensions({ width: rect.width, height: rect.height })
      }
    }
    updateDimensions()
    window.addEventListener("resize", updateDimensions)
    return () => window.removeEventListener("resize", updateDimensions)
  }, [])

  useEffect(() => {
    const updateBrasiliaTime = () => {
      const now = new Date()
      const brasiliaOffset = -3 * 60 // UTC-3 em minutos
      const utc = now.getTime() + now.getTimezoneOffset() * 60000
      const brasilia = new Date(utc + brasiliaOffset * 60000)

      const hours = brasilia.getHours().toString().padStart(2, "0")
      const minutes = brasilia.getMinutes().toString().padStart(2, "0")
      const seconds = brasilia.getSeconds().toString().padStart(2, "0")

      setBrasiliaTime(`${hours}:${minutes}:${seconds}`)
    }

    updateBrasiliaTime()
    const interval = setInterval(updateBrasiliaTime, 1000)
    return () => clearInterval(interval)
  }, [])

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    setViewState((prev) => {
      const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9
      const newVisible = Math.max(20, Math.min(200, Math.floor(prev.visibleCandles * zoomFactor)))
      return { ...prev, visibleCandles: newVisible }
    })
  }, [])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      setIsDragging(true)
      setDragStart({ x: e.clientX, offset: viewState.offset })
    },
    [viewState.offset],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return
      const dx = e.clientX - dragStart.x
      const candleWidth = dimensions.width / viewState.visibleCandles
      const offsetChange = Math.floor(dx / candleWidth)
      const newOffset = Math.max(
        0,
        Math.min(allCandles.length - viewState.visibleCandles, dragStart.offset + offsetChange),
      )
      setViewState((prev) => ({ ...prev, offset: newOffset }))
      setIsAtLive(newOffset === 0)
    },
    [isDragging, dragStart, dimensions.width, viewState.visibleCandles, allCandles.length],
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length === 1) {
        setIsDragging(true)
        setDragStart({ x: e.touches[0].clientX, offset: viewState.offset })
      }
    },
    [viewState.offset],
  )

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging || e.touches.length !== 1) return
      const dx = e.touches[0].clientX - dragStart.x
      const candleWidth = dimensions.width / viewState.visibleCandles
      const offsetChange = Math.floor(dx / candleWidth)
      const newOffset = Math.max(
        0,
        Math.min(allCandles.length - viewState.visibleCandles, dragStart.offset + offsetChange),
      )
      setViewState((prev) => ({ ...prev, offset: newOffset }))
      setIsAtLive(newOffset === 0)
    },
    [isDragging, dragStart, dimensions.width, viewState.visibleCandles, allCandles.length],
  )

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false)
  }, [])

  const goToLive = useCallback(() => {
    setViewState((prev) => ({ ...prev, offset: 0 }))
    setIsAtLive(true)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (canvas) {
      canvas.addEventListener("wheel", handleWheel, { passive: false })
      return () => canvas.removeEventListener("wheel", handleWheel)
    }
  }, [handleWheel])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || dimensions.width === 0 || dimensions.height === 0) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = dimensions.width * dpr
    canvas.height = dimensions.height * dpr
    ctx.scale(dpr, dpr)

    // Background
    ctx.fillStyle = "#0B0F14"
    ctx.fillRect(0, 0, dimensions.width, dimensions.height)

    if (allCandles.length === 0) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)"
      ctx.font = "14px Inter, sans-serif"
      ctx.textAlign = "center"
      ctx.fillText("Carregando...", dimensions.width / 2, dimensions.height / 2)
      return
    }

    const startIdx = Math.max(0, allCandles.length - viewState.visibleCandles - viewState.offset)
    const endIdx = Math.min(allCandles.length, startIdx + viewState.visibleCandles)
    const visibleCandles = allCandles.slice(startIdx, endIdx)

    if (visibleCandles.length === 0) return

    // Calcular range de preços
    let minPrice = Math.min(...visibleCandles.map((c) => c.low))
    let maxPrice = Math.max(...visibleCandles.map((c) => c.high))

    // Incluir entryPrice no cálculo de min/max
    if (entryPrice) {
      minPrice = Math.min(minPrice, entryPrice)
      maxPrice = Math.max(maxPrice, entryPrice)
    }

    // Incluir trades ativos no cálculo
    activeTrades.forEach((trade) => {
      if (trade.symbol === symbol) {
        minPrice = Math.min(minPrice, trade.entryPrice)
        maxPrice = Math.max(maxPrice, trade.entryPrice)
      }
    })

    const range = maxPrice - minPrice || 0.001
    const padding = range * 0.1
    minPrice -= padding
    maxPrice += padding
    const totalRange = maxPrice - minPrice

    const chartPadding = { top: 40, right: 80, bottom: 30, left: 10 }
    const chartWidth = dimensions.width - chartPadding.left - chartPadding.right
    const chartHeight = dimensions.height - chartPadding.top - chartPadding.bottom

    const priceToY = (price: number) => {
      return chartPadding.top + ((maxPrice - price) / totalRange) * chartHeight
    }

    // Grid lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.03)"
    ctx.lineWidth = 1

    for (let i = 0; i <= 5; i++) {
      const y = chartPadding.top + (chartHeight / 5) * i
      ctx.beginPath()
      ctx.moveTo(chartPadding.left, y)
      ctx.lineTo(chartPadding.left + chartWidth, y)
      ctx.stroke()

      const price = maxPrice - (totalRange / 5) * i
      ctx.fillStyle = "rgba(255, 255, 255, 0.35)"
      ctx.font = "11px monospace"
      ctx.textAlign = "left"
      ctx.fillText(formatPrice(price, symbol), chartPadding.left + chartWidth + 8, y + 4)
    }

    // Desenhar candles
    const candleSpacing = chartWidth / visibleCandles.length
    const candleWidth = Math.max(2, Math.min(12, candleSpacing * 0.7))

    for (let i = 0; i < visibleCandles.length; i++) {
      const candle = visibleCandles[i]
      const x = chartPadding.left + i * candleSpacing + candleSpacing / 2

      const openY = priceToY(candle.open)
      const closeY = priceToY(candle.close)
      const highY = priceToY(candle.high)
      const lowY = priceToY(candle.low)

      const isBullish = candle.close >= candle.open
      const bodyColor = isBullish ? "#f97316" : "#EF4444"
      const wickColor = isBullish ? "#f97316" : "#EF4444"

      // Wick
      ctx.strokeStyle = wickColor
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, highY)
      ctx.lineTo(x, lowY)
      ctx.stroke()

      // Body
      ctx.fillStyle = bodyColor
      const bodyTop = Math.min(openY, closeY)
      const bodyHeight = Math.max(1, Math.abs(closeY - openY))
      ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight)
    }

    // Linha do preço atual
    if (currentPrice > 0) {
      const priceY = priceToY(currentPrice)

      ctx.strokeStyle = "rgba(22, 163, 74, 0.6)"
      ctx.lineWidth = 1
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(chartPadding.left, priceY)
      ctx.lineTo(chartPadding.left + chartWidth, priceY)
      ctx.stroke()
      ctx.setLineDash([])

      // Badge do preço atual
      ctx.fillStyle = "#f97316"
      ctx.fillRect(chartPadding.left + chartWidth + 2, priceY - 10, 75, 20)
      ctx.fillStyle = "#fff"
      ctx.font = "bold 11px monospace"
      ctx.textAlign = "center"
      ctx.fillText(formatPrice(currentPrice, symbol), chartPadding.left + chartWidth + 40, priceY + 4)
    }

    const drawTradeLine = (
      tradeEntryPrice: number,
      tradeDirection: "CALL" | "PUT",
      tradeExpiryTime?: number,
      tradeSymbol?: string,
    ) => {
      // Só desenhar se for o mesmo símbolo
      if (tradeSymbol && tradeSymbol !== symbol) return

      const entryY = priceToY(tradeEntryPrice)
      const isCall = tradeDirection === "CALL"
      const color = isCall ? "#fb923c" : "#EF4444"
      const bgColor = isCall ? "rgba(34, 197, 94, 0.1)" : "rgba(239, 68, 68, 0.1)"

      // Área de destaque (mais sutil)
      ctx.fillStyle = bgColor
      if (isCall) {
        ctx.fillRect(chartPadding.left, chartPadding.top, chartWidth, entryY - chartPadding.top)
      } else {
        ctx.fillRect(chartPadding.left, entryY, chartWidth, chartHeight - (entryY - chartPadding.top))
      }

      // Glow effect
      ctx.strokeStyle = isCall ? "rgba(34, 197, 94, 0.2)" : "rgba(239, 68, 68, 0.2)"
      ctx.lineWidth = 6
      ctx.setLineDash([])
      ctx.beginPath()
      ctx.moveTo(chartPadding.left, entryY)
      ctx.lineTo(chartPadding.left + chartWidth, entryY)
      ctx.stroke()

      // Linha principal
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(chartPadding.left, entryY)
      ctx.lineTo(chartPadding.left + chartWidth, entryY)
      ctx.stroke()

      // Círculo com seta
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(chartPadding.left + 20, entryY, 10, 0, Math.PI * 2)
      ctx.fill()

      // Seta dentro do círculo
      ctx.fillStyle = "#FFFFFF"
      ctx.beginPath()
      if (isCall) {
        ctx.moveTo(chartPadding.left + 20, entryY - 5)
        ctx.lineTo(chartPadding.left + 15, entryY + 3)
        ctx.lineTo(chartPadding.left + 25, entryY + 3)
      } else {
        ctx.moveTo(chartPadding.left + 20, entryY + 5)
        ctx.lineTo(chartPadding.left + 15, entryY - 3)
        ctx.lineTo(chartPadding.left + 25, entryY - 3)
      }
      ctx.closePath()
      ctx.fill()

      // Badge de direção
      const labelText = isCall ? "COMPRA" : "VENDA"
      const labelWidth = 70
      const labelX = chartPadding.left + 40

      ctx.fillStyle = color
      ctx.beginPath()
      ctx.roundRect(labelX, entryY - 12, labelWidth, 24, 6)
      ctx.fill()

      ctx.fillStyle = "#FFFFFF"
      ctx.font = "bold 11px Inter, sans-serif"
      ctx.textAlign = "center"
      ctx.fillText(labelText, labelX + labelWidth / 2, entryY + 4)

      // Timer se houver expiryTime
      if (tradeExpiryTime) {
        const now = Date.now()
        const remaining = Math.max(0, Math.ceil((tradeExpiryTime * 1000 - now) / 1000))
        const minutes = Math.floor(remaining / 60)
        const seconds = remaining % 60
        const timeText = `${minutes}:${seconds.toString().padStart(2, "0")}`

        const timeBoxX = labelX + labelWidth + 10

        ctx.fillStyle = "rgba(0, 0, 0, 0.85)"
        ctx.beginPath()
        ctx.roundRect(timeBoxX, entryY - 12, 55, 24, 6)
        ctx.fill()

        ctx.strokeStyle = color
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.roundRect(timeBoxX, entryY - 12, 55, 24, 6)
        ctx.stroke()

        ctx.fillStyle = "#FFFFFF"
        ctx.font = "bold 12px monospace"
        ctx.textAlign = "center"
        ctx.fillText(timeText, timeBoxX + 27.5, entryY + 4)
      }

      // Preço de entrada
      const priceBoxWidth = 75
      const priceBoxX = chartPadding.left + chartWidth - priceBoxWidth - 5

      ctx.fillStyle = color
      ctx.beginPath()
      ctx.roundRect(priceBoxX, entryY - 12, priceBoxWidth, 24, 6)
      ctx.fill()

      ctx.fillStyle = "#FFFFFF"
      ctx.font = "bold 11px monospace"
      ctx.textAlign = "center"
      ctx.fillText(formatPrice(tradeEntryPrice, symbol), priceBoxX + priceBoxWidth / 2, entryY + 4)
    }

    // Desenhar trade único (compatibilidade)
    if (entryPrice && direction) {
      drawTradeLine(entryPrice, direction, expiryTime, symbol)
    }

    // Desenhar múltiplos trades ativos
    activeTrades.forEach((trade) => {
      drawTradeLine(trade.entryPrice, trade.direction, trade.expiryTime, trade.symbol)
    })

    // Labels do gráfico
    const tfLabel = timeframe === 60 ? "1M" : timeframe === 300 ? "5M" : "10M"
    ctx.fillStyle = "rgba(255, 255, 255, 0.8)"
    ctx.font = "bold 15px Inter, sans-serif"
    ctx.textAlign = "left"
    ctx.fillText(formatSymbolName(symbol), chartPadding.left + 10, 25)

    ctx.fillStyle = "rgba(255, 255, 255, 0.4)"
    ctx.font = "12px Inter, sans-serif"
    ctx.fillText(tfLabel, chartPadding.left + 140, 25)

    // Time labels
    ctx.fillStyle = "rgba(255, 255, 255, 0.35)"
    ctx.font = "10px monospace"
    ctx.textAlign = "center"
    const timeLabels = 5
    for (let i = 0; i <= timeLabels; i++) {
      const idx = Math.floor((visibleCandles.length / timeLabels) * i)
      if (idx < visibleCandles.length) {
        const candle = visibleCandles[idx]
        const x = chartPadding.left + idx * candleSpacing + candleSpacing / 2
        const date = new Date(candle.time * 1000)
        const timeStr = `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`
        ctx.fillText(timeStr, x, dimensions.height - 10)
      }
    }
  }, [
    candles,
    currentCandle,
    currentPrice,
    dimensions,
    timeframe,
    symbol,
    entryPrice,
    direction,
    expiryTime,
    viewState,
    activeTrades,
  ])

  return (
    <div ref={containerRef} className="w-full h-full relative select-none">
      <canvas
        ref={canvasRef}
        className="w-full h-full cursor-crosshair"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />

      <div className="absolute bottom-8 left-3 flex items-center gap-1.5 text-[10px] text-white/50 font-mono">
        <span>{brasiliaTime}</span>
        <span className="text-white/30">BRT</span>
      </div>

      {/* Botão LIVE */}
      {!isAtLive && (
        <button
          onClick={goToLive}
          className="absolute top-2 right-2 px-3 py-1.5 rounded-lg text-white text-xs font-bold flex items-center gap-1.5 shadow-lg"
          style={{ backgroundColor: "#f97316" }}
        >
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          LIVE
        </button>
      )}

      {isAtLive && (
        <div
          className="absolute top-2 right-2 px-3 py-1.5 rounded-lg text-white text-xs font-bold flex items-center gap-1.5"
          style={{ backgroundColor: "rgba(22, 163, 74, 0.8)" }}
        >
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          LIVE
        </div>
      )}
    </div>
  )
}
