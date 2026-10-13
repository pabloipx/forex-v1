"use client"

import { useEffect, useRef, useState } from "react"
import { TrendingUp, TrendingDown } from "lucide-react"

interface Candle {
  open: number
  close: number
  high: number
  low: number
}

const PURPLE_UP = "#fb923c"
const PURPLE_UP_WICK = "#fdba74"
const RED_DOWN = "#ef4444"
const RED_DOWN_WICK = "#f87171"

function makeCandle(prevClose: number): Candle {
  const volatility = prevClose * 0.0016
  const drift = (Math.random() - 0.48) * volatility * 2
  const open = prevClose
  const close = Math.max(0.0001, open + drift)
  const wick = Math.abs(drift) + Math.random() * volatility
  const high = Math.max(open, close) + wick * Math.random()
  const low = Math.min(open, close) - wick * Math.random()
  return { open, close, high, low }
}

export function LiveChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const candlesRef = useRef<Candle[]>([])
  const [price, setPrice] = useState(1.0842)
  const [changePct, setChangePct] = useState(0)
  const priceRef = useRef(1.0842)
  const firstPriceRef = useRef(1.0842)

  // Inicializa candles
  useEffect(() => {
    const seed: Candle[] = []
    let last = 1.0842
    for (let i = 0; i < 60; i++) {
      const c = makeCandle(last)
      seed.push(c)
      last = c.close
    }
    candlesRef.current = seed
    firstPriceRef.current = seed[0].open
    priceRef.current = last
  }, [])

  // Atualiza candles periodicamente (o gráfico "se mexendo")
  useEffect(() => {
    const id = setInterval(() => {
      const arr = candlesRef.current
      if (arr.length === 0) return
      const last = arr[arr.length - 1]
      const next = makeCandle(last.close)
      arr.push(next)
      if (arr.length > 60) arr.shift()
      priceRef.current = next.close
      setPrice(next.close)
      setChangePct(((next.close - firstPriceRef.current) / firstPriceRef.current) * 100)
    }, 900)
    return () => clearInterval(id)
  }, [])

  // Loop de renderização suave
  useEffect(() => {
    let raf = 0
    const render = () => {
      const canvas = canvasRef.current
      if (!canvas) {
        raf = requestAnimationFrame(render)
        return
      }
      const ctx = canvas.getContext("2d")
      if (!ctx) {
        raf = requestAnimationFrame(render)
        return
      }
      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
        canvas.width = rect.width * dpr
        canvas.height = rect.height * dpr
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const w = rect.width
      const h = rect.height
      ctx.clearRect(0, 0, w, h)

      const candles = candlesRef.current
      if (candles.length === 0) {
        raf = requestAnimationFrame(render)
        return
      }

      const padding = { top: 16, bottom: 20, left: 8, right: 64 }
      const chartW = w - padding.left - padding.right
      const chartH = h - padding.top - padding.bottom

      let min = Infinity
      let max = -Infinity
      for (const c of candles) {
        if (c.low < min) min = c.low
        if (c.high > max) max = c.high
      }
      const range = max - min || 1
      const pad = range * 0.08
      min -= pad
      max += pad
      const span = max - min

      const yOf = (v: number) => padding.top + chartH - ((v - min) / span) * chartH

      // Grade
      ctx.strokeStyle = "rgba(255,255,255,0.05)"
      ctx.lineWidth = 1
      ctx.fillStyle = "rgba(255,255,255,0.35)"
      ctx.font = "10px ui-sans-serif, system-ui"
      for (let i = 0; i <= 4; i++) {
        const y = padding.top + (chartH / 4) * i
        ctx.beginPath()
        ctx.moveTo(padding.left, y)
        ctx.lineTo(padding.left + chartW, y)
        ctx.stroke()
        const val = max - (span / 4) * i
        ctx.fillText(val.toFixed(4), padding.left + chartW + 8, y + 3)
      }

      const n = candles.length
      const slot = chartW / n
      const bodyW = Math.max(2, slot * 0.6)

      candles.forEach((c, i) => {
        const x = padding.left + slot * i + slot / 2
        const up = c.close >= c.open
        const wickColor = up ? PURPLE_UP_WICK : RED_DOWN_WICK
        const bodyColor = up ? PURPLE_UP : RED_DOWN

        // Pavio
        ctx.strokeStyle = wickColor
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(x, yOf(c.high))
        ctx.lineTo(x, yOf(c.low))
        ctx.stroke()

        // Corpo
        const yOpen = yOf(c.open)
        const yClose = yOf(c.close)
        const top = Math.min(yOpen, yClose)
        const bh = Math.max(1.5, Math.abs(yClose - yOpen))
        ctx.fillStyle = bodyColor
        ctx.fillRect(x - bodyW / 2, top, bodyW, bh)
      })

      // Linha de preço atual
      const lastClose = candles[candles.length - 1].close
      const yPrice = yOf(lastClose)
      ctx.strokeStyle = "rgba(251, 146, 60,0.7)"
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      ctx.moveTo(padding.left, yPrice)
      ctx.lineTo(padding.left + chartW, yPrice)
      ctx.stroke()
      ctx.setLineDash([])

      // Etiqueta de preço
      ctx.fillStyle = "#f97316"
      ctx.fillRect(padding.left + chartW, yPrice - 9, padding.right - 4, 18)
      ctx.fillStyle = "#fff"
      ctx.font = "bold 10px ui-sans-serif, system-ui"
      ctx.fillText(lastClose.toFixed(4), padding.left + chartW + 6, yPrice + 3)

      raf = requestAnimationFrame(render)
    }
    raf = requestAnimationFrame(render)
    return () => cancelAnimationFrame(raf)
  }, [])

  const up = changePct >= 0

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#0b0e14]/80 p-4 shadow-[0_20px_60px_-15px_rgba(249, 115, 22,0.35)] backdrop-blur-sm">
      {/* Cabeçalho do gráfico */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f97316]/20 text-xs font-bold text-[#fdba74]">
            EUR
          </span>
          <div className="text-left">
            <p className="text-sm font-semibold text-white">EUR/USD OTC</p>
            <p className="text-[11px] text-white/40">Tempo real</p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-mono text-sm font-bold text-white">{price.toFixed(4)}</p>
          <p
            className={`flex items-center justify-end gap-1 text-[11px] font-semibold ${
              up ? "text-[#fdba74]" : "text-red-400"
            }`}
          >
            {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {up ? "+" : ""}
            {changePct.toFixed(2)}%
          </p>
        </div>
      </div>

      {/* Canvas do gráfico */}
      <canvas ref={canvasRef} className="h-[260px] w-full sm:h-[300px]" />

      {/* Faixa de status "ao vivo" */}
      <div className="mt-2 flex items-center gap-2 text-[11px] text-white/40">
        <span className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#fdba74] opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#fb923c]" />
          </span>
          Mercado ao vivo
        </span>
        <span className="ml-auto">Atualização automática</span>
      </div>
    </div>
  )
}
