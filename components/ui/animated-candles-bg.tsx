"use client"

import { useEffect, useRef } from "react"

interface Candle {
  x: number
  y: number
  width: number
  height: number
  isGreen: boolean
  wickTop: number
  wickBottom: number
  speed: number
  opacity: number
}

export function AnimatedCandlesBg() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let animationId: number
    let candles: Candle[] = []

    const resizeCanvas = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      initCandles()
    }

    const initCandles = () => {
      candles = []
      const isMobile = canvas.width < 768
      const spacing = isMobile ? 30 : 60
      const minCandles = isMobile ? 15 : 20
      const candleCount = Math.max(minCandles, Math.floor(canvas.width / spacing))

      for (let i = 0; i < candleCount; i++) {
        const x = isMobile ? i * spacing + Math.random() * 15 : i * spacing + Math.random() * 30
        candles.push(createCandle(x))
      }
    }

    const createCandle = (x: number): Candle => {
      const isMobile = canvas.width < 768
      const isGreen = Math.random() > 0.45
      const height = isMobile ? 20 + Math.random() * 50 : 30 + Math.random() * 80
      const wickTop = isMobile ? 5 + Math.random() * 20 : 10 + Math.random() * 30
      const wickBottom = isMobile ? 5 + Math.random() * 20 : 10 + Math.random() * 30

      return {
        x,
        y: canvas.height + Math.random() * 200,
        width: isMobile ? 5 + Math.random() * 8 : 8 + Math.random() * 12,
        height,
        isGreen,
        wickTop,
        wickBottom,
        speed: isMobile ? 0.4 + Math.random() * 0.8 : 0.3 + Math.random() * 0.7,
        opacity: 0.15 + Math.random() * 0.25,
      }
    }

    const drawCandle = (candle: Candle) => {
      const { x, y, width, height, isGreen, wickTop, wickBottom, opacity } = candle

      // Colors
      const bodyColor = isGreen ? `rgba(249, 115, 22, ${opacity})` : `rgba(239, 68, 68, ${opacity})`
      const wickColor = isGreen ? `rgba(249, 115, 22, ${opacity * 0.7})` : `rgba(239, 68, 68, ${opacity * 0.7})`

      // Draw wick (linha vertical)
      ctx.beginPath()
      ctx.strokeStyle = wickColor
      ctx.lineWidth = 2
      ctx.moveTo(x + width / 2, y - wickTop)
      ctx.lineTo(x + width / 2, y + height + wickBottom)
      ctx.stroke()

      // Draw body (retângulo)
      ctx.fillStyle = bodyColor
      ctx.fillRect(x, y, width, height)

      // Draw border
      ctx.strokeStyle = isGreen ? `rgba(251, 146, 60, ${opacity * 1.5})` : `rgba(248, 113, 113, ${opacity * 1.5})`
      ctx.lineWidth = 1
      ctx.strokeRect(x, y, width, height)

      // Glow effect
      ctx.shadowColor = isGreen ? "#f97316" : "#EF4444"
      ctx.shadowBlur = 15
      ctx.fillStyle = bodyColor
      ctx.fillRect(x, y, width, height)
      ctx.shadowBlur = 0
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      candles.forEach((candle, index) => {
        candle.y -= candle.speed

        // Reset candle when it goes off screen
        if (candle.y + candle.height + candle.wickBottom < 0) {
          candles[index] = createCandle(candle.x)
          candles[index].y = canvas.height + 50
        }

        drawCandle(candle)
      })

      animationId = requestAnimationFrame(animate)
    }

    resizeCanvas()
    window.addEventListener("resize", resizeCanvas)
    animate()

    return () => {
      window.removeEventListener("resize", resizeCanvas)
      cancelAnimationFrame(animationId)
    }
  }, [])

  return <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-0" style={{ opacity: 0.6 }} />
}
