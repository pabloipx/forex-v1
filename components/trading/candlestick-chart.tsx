"use client"

import { useEffect, useRef, useState } from "react"
import type { Candle } from "@/lib/price-engine/candle-aggregator"

interface CandlestickChartProps {
  candles: Candle[]
  currentCandle: Candle | null
  currentPrice: number
  symbol: string
  timeframe: 60 | 300 | 600 | 900
  entryPrice?: number
  direction?: "CALL" | "PUT"
  expiryTime?: number
}

export function CandlestickChart({
  candles,
  currentCandle,
  currentPrice,
  symbol,
  timeframe,
  entryPrice,
  direction,
  expiryTime,
}: CandlestickChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  // Update canvas dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        })
      }
    }

    updateDimensions()
    window.addEventListener("resize", updateDimensions)
    return () => window.removeEventListener("resize", updateDimensions)
  }, [])

  // Draw chart
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || dimensions.width === 0 || dimensions.height === 0) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, dimensions.width, dimensions.height)

    // Combine completed candles with current candle
    const allCandles = [...candles]
    if (currentCandle) {
      allCandles.push(currentCandle)
    }

    if (allCandles.length === 0) return

    // Calculate price range
    let minPrice = Number.POSITIVE_INFINITY
    let maxPrice = Number.NEGATIVE_INFINITY

    for (const candle of allCandles) {
      minPrice = Math.min(minPrice, candle.low)
      maxPrice = Math.max(maxPrice, candle.high)
    }

    // Add padding to price range
    const priceRange = maxPrice - minPrice
    const padding = priceRange * 0.1
    minPrice -= padding
    maxPrice += padding

    // Chart dimensions
    const chartPadding = { top: 20, right: 60, bottom: 30, left: 20 }
    const chartWidth = dimensions.width - chartPadding.left - chartPadding.right
    const chartHeight = dimensions.height - chartPadding.top - chartPadding.bottom

    // Draw grid (subtle)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)"
    ctx.lineWidth = 1

    // Horizontal grid lines
    const gridLines = 5
    for (let i = 0; i <= gridLines; i++) {
      const y = chartPadding.top + (chartHeight / gridLines) * i
      ctx.beginPath()
      ctx.moveTo(chartPadding.left, y)
      ctx.lineTo(chartPadding.left + chartWidth, y)
      ctx.stroke()

      // Draw price labels
      const price = maxPrice - (priceRange / gridLines) * i
      ctx.fillStyle = "rgba(255, 255, 255, 0.5)"
      ctx.font = "11px monospace"
      ctx.textAlign = "left"
      ctx.fillText(price.toFixed(5), chartPadding.left + chartWidth + 10, y + 4)
    }

    // Calculate candle width
    const visibleCandles = Math.min(50, allCandles.length)
    const candleWidth = Math.max(4, chartWidth / visibleCandles - 2)
    const candleSpacing = chartWidth / visibleCandles

    // Draw candles (most recent on right)
    const startIndex = Math.max(0, allCandles.length - visibleCandles)
    for (let i = startIndex; i < allCandles.length; i++) {
      const candle = allCandles[i]
      const x = chartPadding.left + (i - startIndex) * candleSpacing + candleSpacing / 2

      // Price to Y coordinate
      const priceToY = (price: number) => {
        const ratio = (maxPrice - price) / priceRange
        return chartPadding.top + ratio * chartHeight
      }

      const openY = priceToY(candle.open)
      const closeY = priceToY(candle.close)
      const highY = priceToY(candle.high)
      const lowY = priceToY(candle.low)

      const isBullish = candle.close >= candle.open
      const color = isBullish ? "#10b981" : "#ef4444"

      // Draw wick
      ctx.strokeStyle = color
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, highY)
      ctx.lineTo(x, lowY)
      ctx.stroke()

      // Draw body
      ctx.fillStyle = color
      const bodyTop = Math.min(openY, closeY)
      const bodyHeight = Math.max(2, Math.abs(closeY - openY))
      ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight)
    }

    // Draw current price line
    const currentPriceY = chartPadding.top + ((maxPrice - currentPrice) / priceRange) * chartHeight
    ctx.strokeStyle = "rgba(255, 255, 255, 0.6)"
    ctx.lineWidth = 1
    ctx.setLineDash([5, 5])
    ctx.beginPath()
    ctx.moveTo(chartPadding.left, currentPriceY)
    ctx.lineTo(chartPadding.left + chartWidth, currentPriceY)
    ctx.stroke()
    ctx.setLineDash([])

    // Draw current price label
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)"
    ctx.fillRect(chartPadding.left + chartWidth + 5, currentPriceY - 10, 50, 20)
    ctx.fillStyle = "#000"
    ctx.font = "bold 11px monospace"
    ctx.textAlign = "center"
    ctx.fillText(currentPrice.toFixed(5), chartPadding.left + chartWidth + 30, currentPriceY + 4)

    // Draw entry price marker if exists
    if (entryPrice) {
      const entryY = chartPadding.top + ((maxPrice - entryPrice) / priceRange) * chartHeight
      const entryColor = direction === "CALL" ? "#10b981" : "#ef4444"

      ctx.strokeStyle = entryColor
      ctx.lineWidth = 2
      ctx.setLineDash([3, 3])
      ctx.beginPath()
      ctx.moveTo(chartPadding.left, entryY)
      ctx.lineTo(chartPadding.left + chartWidth, entryY)
      ctx.stroke()
      ctx.setLineDash([])

      // Draw entry marker
      ctx.fillStyle = entryColor
      ctx.beginPath()
      ctx.arc(chartPadding.left + chartWidth * 0.7, entryY, 4, 0, Math.PI * 2)
      ctx.fill()

      // Draw label
      ctx.fillStyle = entryColor
      ctx.font = "bold 10px sans-serif"
      ctx.textAlign = "right"
      ctx.fillText(direction || "", chartPadding.left + chartWidth * 0.7 - 10, entryY + 4)
    }

    // Draw expiry line if exists
    if (expiryTime && allCandles.length > 0) {
      const lastCandleTime = allCandles[allCandles.length - 1].time
      const timeRange = timeframe * visibleCandles
      const expiryPosition = (expiryTime - (lastCandleTime - timeRange + timeframe)) / timeRange

      if (expiryPosition >= 0 && expiryPosition <= 1) {
        const expiryX = chartPadding.left + expiryPosition * chartWidth

        ctx.strokeStyle = "rgba(255, 255, 255, 0.4)"
        ctx.lineWidth = 1
        ctx.setLineDash([5, 5])
        ctx.beginPath()
        ctx.moveTo(expiryX, chartPadding.top)
        ctx.lineTo(expiryX, chartPadding.top + chartHeight)
        ctx.stroke()
        ctx.setLineDash([])
      }
    }
  }, [candles, currentCandle, currentPrice, dimensions, timeframe, entryPrice, direction, expiryTime])

  return (
    <div ref={containerRef} className="w-full h-full bg-zinc-950">
      <canvas
        ref={canvasRef}
        width={dimensions.width * 2}
        height={dimensions.height * 2}
        style={{
          width: dimensions.width,
          height: dimensions.height,
        }}
        className="w-full h-full"
      />
    </div>
  )
}
