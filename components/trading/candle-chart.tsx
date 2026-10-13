"use client"

import type React from "react"

import { useRef, useEffect, useState, useCallback } from "react"
import type { Candle, Trade } from "@/lib/price-engine/types"

interface CandleChartProps {
  candles: Candle[]
  currentPrice: number
  activeTrades: Trade[]
  symbol: string
}

export function CandleChart({ candles, currentPrice, activeTrades, symbol }: CandleChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const [offset, setOffset] = useState(0)
  const [zoom, setZoom] = useState(1)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, offset: 0 })

  // Handle resize
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        setDimensions({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        })
      }
    })

    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  // Draw chart
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx || !dimensions.width || !dimensions.height) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = dimensions.width * dpr
    canvas.height = dimensions.height * dpr
    ctx.scale(dpr, dpr)

    // Clear
    ctx.fillStyle = "#0B0F14"
    ctx.fillRect(0, 0, dimensions.width, dimensions.height)

    if (candles.length === 0) {
      ctx.fillStyle = "#6B7280"
      ctx.font = "14px Inter, sans-serif"
      ctx.textAlign = "center"
      ctx.fillText("Carregando dados...", dimensions.width / 2, dimensions.height / 2)
      return
    }

    const padding = { top: 20, right: 80, bottom: 30, left: 10 }
    const chartWidth = dimensions.width - padding.left - padding.right
    const chartHeight = dimensions.height - padding.top - padding.bottom

    // Calculate visible candles based on zoom
    const baseCandles = 60
    const visibleCount = Math.floor(baseCandles / zoom)
    const startIndex = Math.max(0, candles.length - visibleCount - offset)
    const endIndex = Math.min(candles.length, startIndex + visibleCount)
    const visibleCandles = candles.slice(startIndex, endIndex)

    if (visibleCandles.length === 0) return

    // Find price range
    let minPrice = Number.POSITIVE_INFINITY
    let maxPrice = Number.NEGATIVE_INFINITY
    for (const c of visibleCandles) {
      if (c.low < minPrice) minPrice = c.low
      if (c.high > maxPrice) maxPrice = c.high
    }

    // Add padding to price range
    const pricePadding = (maxPrice - minPrice) * 0.15
    minPrice -= pricePadding
    maxPrice += pricePadding

    const priceRange = maxPrice - minPrice || 1
    const candleWidth = chartWidth / visibleCount
    const bodyWidth = Math.max(1, candleWidth * 0.7)

    // Helper functions
    const priceToY = (price: number) => {
      return padding.top + chartHeight - ((price - minPrice) / priceRange) * chartHeight
    }

    // Draw grid lines
    ctx.strokeStyle = "#1f2933"
    ctx.lineWidth = 1

    const gridLines = 5
    for (let i = 0; i <= gridLines; i++) {
      const y = padding.top + (chartHeight / gridLines) * i
      ctx.beginPath()
      ctx.moveTo(padding.left, y)
      ctx.lineTo(dimensions.width - padding.right, y)
      ctx.stroke()

      // Price labels
      const price = maxPrice - (priceRange / gridLines) * i
      ctx.fillStyle = "#6B7280"
      ctx.font = "10px monospace"
      ctx.textAlign = "left"
      ctx.fillText(formatPrice(price), dimensions.width - padding.right + 5, y + 3)
    }

    // Draw candles
    visibleCandles.forEach((candle, index) => {
      const x = padding.left + index * candleWidth + candleWidth / 2
      const isGreen = candle.close >= candle.open

      const openY = priceToY(candle.open)
      const closeY = priceToY(candle.close)
      const highY = priceToY(candle.high)
      const lowY = priceToY(candle.low)

      // Wick
      ctx.strokeStyle = isGreen ? "#fb923c" : "#EF4444"
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, highY)
      ctx.lineTo(x, lowY)
      ctx.stroke()

      // Body
      ctx.fillStyle = isGreen ? "#fb923c" : "#EF4444"
      const bodyTop = Math.min(openY, closeY)
      const bodyHeight = Math.max(1, Math.abs(closeY - openY))
      ctx.fillRect(x - bodyWidth / 2, bodyTop, bodyWidth, bodyHeight)
    })

    // Draw current price line
    const currentY = priceToY(currentPrice)
    ctx.strokeStyle = "#f97316"
    ctx.lineWidth = 1
    ctx.setLineDash([5, 3])
    ctx.beginPath()
    ctx.moveTo(padding.left, currentY)
    ctx.lineTo(dimensions.width - padding.right, currentY)
    ctx.stroke()
    ctx.setLineDash([])

    // Current price label
    ctx.fillStyle = "#f97316"
    ctx.fillRect(dimensions.width - padding.right, currentY - 10, padding.right - 5, 20)
    ctx.fillStyle = "#FFFFFF"
    ctx.font = "bold 10px monospace"
    ctx.textAlign = "left"
    ctx.fillText(formatPrice(currentPrice), dimensions.width - padding.right + 5, currentY + 4)

    // Draw active trades
    activeTrades
      .filter((t) => t.symbol === symbol)
      .forEach((trade) => {
        const entryY = priceToY(trade.entryPrice)
        const isCall = trade.direction === "call"

        ctx.strokeStyle = isCall ? "#fb923c" : "#EF4444"
        ctx.lineWidth = 2
        ctx.setLineDash([3, 3])
        ctx.beginPath()
        ctx.moveTo(padding.left, entryY)
        ctx.lineTo(dimensions.width - padding.right, entryY)
        ctx.stroke()
        ctx.setLineDash([])

        // Trade label
        ctx.fillStyle = isCall ? "#fb923c" : "#EF4444"
        ctx.fillRect(padding.left, entryY - 12, 60, 24)
        ctx.fillStyle = "#FFFFFF"
        ctx.font = "bold 10px Inter, sans-serif"
        ctx.textAlign = "center"
        ctx.fillText(isCall ? "▲ CALL" : "▼ PUT", padding.left + 30, entryY + 4)
      })

    // Time labels
    ctx.fillStyle = "#6B7280"
    ctx.font = "10px monospace"
    ctx.textAlign = "center"

    const timeStep = Math.ceil(visibleCandles.length / 6)
    visibleCandles.forEach((candle, index) => {
      if (index % timeStep === 0) {
        const x = padding.left + index * candleWidth + candleWidth / 2
        const date = new Date(candle.time * 1000)
        const label = `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`
        ctx.fillText(label, x, dimensions.height - 10)
      }
    })
  }, [candles, currentPrice, dimensions, offset, zoom, activeTrades, symbol])

  const formatPrice = (price: number) => {
    if (symbol.includes("BTC")) return price.toFixed(2)
    if (symbol.includes("JPY")) return price.toFixed(3)
    if (symbol.includes("ETH") || symbol.includes("BNB")) return price.toFixed(2)
    if (symbol.includes("GOLD") || symbol.includes("OIL") || symbol.includes("SILVER")) return price.toFixed(2)
    return price.toFixed(5)
  }

  // Mouse handlers for pan
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      setIsDragging(true)
      setDragStart({ x: e.clientX, offset })
    },
    [offset],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return
      const dx = e.clientX - dragStart.x
      const candleWidth = dimensions.width / (60 / zoom)
      const newOffset = Math.max(0, dragStart.offset - Math.round(dx / candleWidth))
      setOffset(Math.min(newOffset, Math.max(0, candles.length - 10)))
    },
    [isDragging, dragStart, dimensions.width, zoom, candles.length],
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Touch handlers for mobile
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const touch = e.touches[0]
      setIsDragging(true)
      setDragStart({ x: touch.clientX, offset })
    },
    [offset],
  )

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging) return
      const touch = e.touches[0]
      const dx = touch.clientX - dragStart.x
      const candleWidth = dimensions.width / (60 / zoom)
      const newOffset = Math.max(0, dragStart.offset - Math.round(dx / candleWidth))
      setOffset(Math.min(newOffset, Math.max(0, candles.length - 10)))
    },
    [isDragging, dragStart, dimensions.width, zoom, candles.length],
  )

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Wheel handler for zoom
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    setZoom((prev) => Math.max(0.5, Math.min(3, prev + (e.deltaY > 0 ? -0.1 : 0.1))))
  }, [])

  return (
    <div ref={containerRef} className="w-full h-full relative bg-[#0B0F14] rounded-xl overflow-hidden">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 cursor-crosshair"
        style={{ width: dimensions.width, height: dimensions.height }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
      />

      {/* Zoom controls */}
      <div className="absolute bottom-12 right-2 flex flex-col gap-1">
        <button
          onClick={() => setZoom((z) => Math.min(3, z + 0.2))}
          className="w-8 h-8 bg-[#121826] border border-[#1f2933] rounded-lg text-white hover:bg-[#1f2933] transition-colors flex items-center justify-center text-lg font-bold"
        >
          +
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(0.5, z - 0.2))}
          className="w-8 h-8 bg-[#121826] border border-[#1f2933] rounded-lg text-white hover:bg-[#1f2933] transition-colors flex items-center justify-center text-lg font-bold"
        >
          −
        </button>
        <button
          onClick={() => {
            setZoom(1)
            setOffset(0)
          }}
          className="w-8 h-8 bg-[#121826] border border-[#1f2933] rounded-lg text-[#9CA3AF] hover:bg-[#1f2933] hover:text-white transition-colors flex items-center justify-center text-xs"
        >
          R
        </button>
      </div>
    </div>
  )
}
