"use client"

import useSWR from "swr"
import { cn } from "@/lib/utils"

type Coin = { symbol: string; name: string; color: string; price: number; change: number; spark: number[] }

const COINS: Coin[] = [
  { symbol: "BTC", name: "Bitcoin", color: "#F7931A", price: 64973.78, change: 1.47, spark: [] },
  { symbol: "ETH", name: "Ethereum", color: "#627EEA", price: 1926.81, change: 2.96, spark: [] },
  { symbol: "SOL", name: "Solana", color: "#9945FF", price: 77.3, change: 0.1, spark: [] },
  { symbol: "XRP", name: "XRP", color: "#23292F", price: 1.11, change: 1.03, spark: [] },
  { symbol: "DOGE", name: "Dogecoin", color: "#C2A633", price: 0.13, change: 0.87, spark: [] },
]

async function loadCoins(): Promise<Coin[]> {
  return Promise.all(
    COINS.map(async (coin) => {
      try {
        const [statsRes, candlesRes] = await Promise.all([
          fetch(`https://api.exchange.coinbase.com/products/${coin.symbol}-USD/stats`),
          fetch(`https://api.exchange.coinbase.com/products/${coin.symbol}-USD/candles?granularity=3600`),
        ])
        const stats = statsRes.ok ? await statsRes.json() : null
        const candles: number[][] = candlesRes.ok ? await candlesRes.json() : []
        const last = Number(stats?.last)
        const open = Number(stats?.open)
        const spark = candles.slice(0, 24).reverse().map((c) => c[4])
        if (!Number.isFinite(last) || !Number.isFinite(open) || open === 0) return { ...coin, spark }
        return { ...coin, price: last, change: ((last - open) / open) * 100, spark }
      } catch {
        return coin
      }
    }),
  )
}

function formatPrice(v: number) {
  const digits = v >= 1 ? 2 : 4
  return `US$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`
}

function Sparkline({ points, up }: { points: number[]; up: boolean }) {
  if (points.length < 2) return <div className="h-9 w-16 shrink-0" aria-hidden="true" />
  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1
  const coords = points.map((p, i) => `${(i / (points.length - 1)) * 96},${34 - ((p - min) / range) * 30}`)
  const line = `M${coords.join(" L")}`
  return (
    <svg viewBox="0 0 96 36" preserveAspectRatio="none" className={cn("h-9 w-16 shrink-0", up ? "text-lp-up" : "text-lp-down")} aria-hidden="true">
      <path d={`${line} L96,36 L0,36 Z`} fill="currentColor" opacity={0.1} />
      <path d={line} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinejoin="round" />
    </svg>
  )
}

export function KbTicker() {
  const { data = COINS } = useSWR("kb-ticker", loadCoins, { refreshInterval: 30000, fallbackData: COINS })

  return (
    <section id="mercados" aria-label="Cotações" className="scroll-mt-24 px-6">
      <div className="mx-auto max-w-7xl">
        <ul className="grid grid-cols-1 divide-y divide-lp-line rounded-2xl bg-lp-bg shadow-[0_10px_40px_-12px_rgba(15,42,143,0.18)] ring-1 ring-lp-line sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-5 lg:divide-x">
          {data.map((c) => {
            const up = c.change >= 0
            return (
              <li key={c.symbol} className="flex items-center justify-between gap-3 px-5 py-5">
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-lp-bg"
                    style={{ backgroundColor: c.color }}
                    aria-hidden="true"
                  >
                    {c.symbol.slice(0, 3)}
                  </span>
                  <div className="flex min-w-0 flex-col whitespace-nowrap leading-tight">
                    <span className="text-sm font-semibold text-lp-ink">
                      {c.name} <span className="text-xs font-medium text-lp-muted">{c.symbol}</span>
                    </span>
                    <span className="mt-1 text-sm font-semibold tabular-nums text-lp-ink">{formatPrice(c.price)}</span>
                    <span className={cn("text-xs font-semibold tabular-nums", up ? "text-lp-up" : "text-lp-down")}>
                      {up ? "+" : ""}
                      {c.change.toFixed(2).replace(".", ",")}%
                    </span>
                  </div>
                </div>
                <Sparkline points={c.spark} up={up} />
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
