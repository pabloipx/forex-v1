"use client"

import { useMemo, useRef, useState } from "react"
import { formatPrice, type FuturesMarket } from "@/lib/futures/markets"
import type { MarketFeed } from "@/hooks/use-market-feed"

const W = 1000
const H = 400

export function DepthChart({ market, feed }: { market: FuturesMarket; feed: MarketFeed }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [hover, setHover] = useState<{ x: number; price: number; total: number; side: "bid" | "ask" } | null>(null)

  const data = useMemo(() => {
    const group = (levels: [number, number][], desc: boolean) => {
      const map = new Map<number, number>()
      for (const [p, q] of levels) if (q > 0) map.set(p, (map.get(p) ?? 0) + q)
      const sorted = [...map.entries()].sort((a, b) => (desc ? b[0] - a[0] : a[0] - b[0]))
      let acc = 0
      return sorted.map(([p, q]) => [p, (acc += q)] as [number, number])
    }
    const bids = group(feed.bids, true)
    const asks = group(feed.asks, false)
    if (!bids.length || !asks.length) return null
    const minP = bids[bids.length - 1][0]
    const maxP = asks[asks.length - 1][0]
    const maxTotal = Math.max(bids[bids.length - 1][1], asks[asks.length - 1][1])
    const range = maxP - minP || 1
    const x = (p: number) => ((p - minP) / range) * W
    const y = (t: number) => H - (t / maxTotal) * (H - 20)
    const path = (pts: [number, number][]) => {
      let d = `M ${x(pts[0][0])} ${H} L ${x(pts[0][0])} ${y(pts[0][1])}`
      for (let i = 1; i < pts.length; i++) d += ` H ${x(pts[i][0])} V ${y(pts[i][1])}`
      return d
    }
    const bidLine = path(bids)
    const askLine = path(asks)
    return {
      bids,
      asks,
      minP,
      maxP,
      maxTotal,
      bidLine,
      askLine,
      bidArea: `${bidLine} V ${H} Z`,
      askArea: `${askLine} V ${H} Z`,
      mid: (bids[0][0] + asks[0][0]) / 2,
    }
  }, [feed.bids, feed.asks])

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-term-muted">
        Profundidade indisponível para este mercado.
      </div>
    )
  }

  const onMove = (e: React.PointerEvent) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    const rx = (e.clientX - rect.left) / rect.width
    const price = data.minP + rx * (data.maxP - data.minP)
    const side = price <= data.mid ? "bid" : "ask"
    const levels = side === "bid" ? data.bids : data.asks
    const hit = side === "bid" ? levels.find((l) => l[0] <= price) : [...levels].reverse().find((l) => l[0] <= price) ?? levels[0]
    const level = hit ?? levels[levels.length - 1]
    setHover({ x: rx * 100, price: level[0], total: level[1], side })
  }

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => data.minP + f * (data.maxP - data.minP))

  return (
    <div className="relative flex h-full flex-col px-3 pb-2 pt-3">
      <div className="mb-2 flex items-center gap-4 text-[11px] text-term-muted">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-long" aria-hidden="true" />
          Compras
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-sm bg-short" aria-hidden="true" />
          Vendas
        </span>
        <span className="ml-auto font-mono">Meio: {formatPrice(data.mid, market.priceDecimals)}</span>
      </div>
      <div className="relative min-h-0 flex-1">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="size-full"
          role="img"
          aria-label={`Gráfico de profundidade de ${market.symbol}`}
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          <path d={data.bidArea} className="fill-long/20" />
          <path d={data.bidLine} className="fill-none stroke-long" strokeWidth={2} vectorEffect="non-scaling-stroke" />
          <path d={data.askArea} className="fill-short/20" />
          <path d={data.askLine} className="fill-none stroke-short" strokeWidth={2} vectorEffect="non-scaling-stroke" />
        </svg>
        {hover && (
          <>
            <div className="pointer-events-none absolute inset-y-0 w-px bg-term-muted/60" style={{ left: `${hover.x}%` }} />
            <div
              className="pointer-events-none absolute top-2 rounded-md border border-term-line bg-term-bg px-2 py-1.5 font-mono text-[11px] text-term-text"
              style={{ left: `min(calc(${hover.x}% + 8px), calc(100% - 150px))` }}
            >
              <div className={hover.side === "bid" ? "text-long" : "text-short"}>{formatPrice(hover.price, market.priceDecimals)}</div>
              <div className="text-term-muted">
                Total: {hover.total.toFixed(market.qtyDecimals)} {market.qtyUnit}
              </div>
            </div>
          </>
        )}
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-term-muted">
        {ticks.map((t, i) => (
          <span key={i}>{formatPrice(t, market.priceDecimals)}</span>
        ))}
      </div>
    </div>
  )
}
