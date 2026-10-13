"use client"

import { useEffect, useRef, useState } from "react"

type Candle = { open: number; close: number; high: number; low: number }

const COUNT = 48

function makeInitial(): Candle[] {
  const candles: Candle[] = []
  let price = 100
  for (let i = 0; i < COUNT; i++) {
    const open = price
    const drift = (Math.random() - 0.48) * 2.4
    const close = Math.max(60, open + drift)
    const high = Math.max(open, close) + Math.random() * 1.2
    const low = Math.min(open, close) - Math.random() * 1.2
    candles.push({ open, close, high, low })
    price = close
  }
  return candles
}

export function LiveCandles({ active = true }: { active?: boolean }) {
  const [candles, setCandles] = useState<Candle[]>(() => makeInitial())
  const lastClose = useRef(candles[candles.length - 1].close)

  useEffect(() => {
    if (!active) return
    const id = setInterval(() => {
      setCandles((prev) => {
        const open = lastClose.current
        const drift = (Math.random() - 0.46) * 2.6
        const close = Math.max(60, open + drift)
        const high = Math.max(open, close) + Math.random() * 1.4
        const low = Math.min(open, close) - Math.random() * 1.4
        lastClose.current = close
        return [...prev.slice(1), { open, close, high, low }]
      })
    }, 900)
    return () => clearInterval(id)
  }, [active])

  const values = candles.flatMap((c) => [c.high, c.low])
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = Math.max(0.0001, max - min)
  const pct = (v: number) => (v - min) / range

  return (
    <div className="flex h-full w-full items-stretch gap-[3px]">
      {candles.map((c, i) => {
        const up = c.close >= c.open
        const color = up ? "#22c55e" : "#ef4444"
        const highPct = pct(c.high)
        const lowPct = pct(c.low)
        const topBody = pct(Math.max(c.open, c.close))
        const botBody = pct(Math.min(c.open, c.close))
        return (
          <div key={i} className="relative flex-1">
            <div
              className="absolute left-1/2 w-px -translate-x-1/2"
              style={{
                top: `${(1 - highPct) * 100}%`,
                height: `${(highPct - lowPct) * 100}%`,
                background: color,
                opacity: 0.55,
              }}
            />
            <div
              className="absolute left-0 right-0 mx-auto rounded-[1px]"
              style={{
                top: `${(1 - topBody) * 100}%`,
                height: `${Math.max(2, (topBody - botBody) * 100)}%`,
                background: color,
                width: "70%",
              }}
            />
          </div>
        )
      })}
    </div>
  )
}
