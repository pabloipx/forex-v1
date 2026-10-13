"use client"

import { useMemo, useState } from "react"
import { ChevronDown, Search } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"
import {
  CATEGORY_LABELS,
  MARKETS,
  formatCompact,
  formatPrice,
  type FuturesMarket,
  type MarketCategory,
} from "@/lib/futures/markets"
import type { Ticker } from "@/hooks/use-futures"

interface TickerBarProps {
  market: FuturesMarket
  ticker: Ticker | null
  last: number | null
  tickers: Record<string, Ticker>
  onSelect: (symbol: string) => void
}

function MarketSelector({ market, tickers, onSelect }: Omit<TickerBarProps, "ticker" | "last">) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState<MarketCategory>(market.category)

  const list = useMemo(() => {
    const q = query.trim().toUpperCase()
    return MARKETS.filter((m) =>
      q ? m.symbol.includes(q) || m.name.toUpperCase().includes(q) : m.category === category,
    )
  }, [query, category])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-2 rounded-md py-1 pr-2 text-left hover:bg-term-line/60">
          <span className="flex size-7 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
            {market.base.slice(0, 3)}
          </span>
          <span className="flex flex-col leading-tight">
            <span className="flex items-center gap-1 text-base font-bold text-term-text">
              {market.symbol}
              <ChevronDown className="size-4 text-term-muted" aria-hidden="true" />
            </span>
            <span className="text-[11px] text-term-muted">
              {market.category === "crypto" ? "Perpétuo" : market.name}
            </span>
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[340px] border-term-line bg-term-panel p-0 text-term-text">
        <div className="border-b border-term-line p-3">
          <label className="flex items-center gap-2 rounded-md bg-term-bg px-2.5 py-1.5">
            <Search className="size-4 text-term-muted" aria-hidden="true" />
            <span className="sr-only">Buscar mercado</span>
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar"
              className="w-full bg-transparent text-sm outline-none placeholder:text-term-muted"
            />
          </label>
          {!query && (
            <div role="tablist" className="mt-3 flex gap-4 text-sm">
              {(Object.keys(CATEGORY_LABELS) as MarketCategory[]).map((c) => (
                <button
                  key={c}
                  role="tab"
                  aria-selected={category === c}
                  onClick={() => setCategory(c)}
                  className={cn(
                    "border-b-2 pb-1 font-medium",
                    category === c ? "border-primary text-term-text" : "border-transparent text-term-muted",
                  )}
                >
                  {CATEGORY_LABELS[c]}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 px-3 py-1.5 text-[11px] text-term-muted">
          <span>Mercado</span>
          <span className="text-right">Preço</span>
          <span className="w-16 text-right">Var. 24h</span>
        </div>
        <ul className="max-h-80 overflow-y-auto pb-2">
          {list.map((m) => {
            const t = tickers[m.symbol]
            const up = (t?.changePercent ?? 0) >= 0
            return (
              <li key={m.symbol}>
                <button
                  onClick={() => {
                    onSelect(m.symbol)
                    setOpen(false)
                    setQuery("")
                  }}
                  className={cn(
                    "grid w-full grid-cols-[1fr_auto_auto] items-center gap-x-4 px-3 py-2 text-left text-sm hover:bg-term-line/60",
                    m.symbol === market.symbol && "bg-term-line/40",
                  )}
                >
                  <span className="flex flex-col leading-tight">
                    <span className="font-semibold">{m.symbol}</span>
                    <span className="text-[11px] text-term-muted">{m.maxLeverage}x</span>
                  </span>
                  <span className="font-mono text-right">{formatPrice(t?.price, m.priceDecimals)}</span>
                  <span className={cn("w-16 text-right font-mono", up ? "text-long" : "text-short")}>
                    {t ? `${up ? "+" : ""}${t.changePercent.toFixed(2)}%` : "--"}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="flex shrink-0 flex-col leading-tight">
      <span className="text-[11px] text-term-muted">{label}</span>
      <span className={cn("font-mono text-xs font-medium text-term-text", className)}>{value}</span>
    </div>
  )
}

export function TickerBar({ market, ticker, last, tickers, onSelect }: TickerBarProps) {
  const price = last ?? ticker?.price ?? null
  const change = ticker?.changePercent ?? 0
  const up = change >= 0
  const spread = ticker ? ticker.ask - ticker.bid : null

  return (
    <div className="flex h-14 shrink-0 items-center gap-6 overflow-x-auto border-b border-term-line bg-term-panel px-3 lg:px-4">
      <MarketSelector market={market} tickers={tickers} onSelect={onSelect} />
      <div className="flex shrink-0 flex-col leading-tight">
        <span className={cn("font-mono text-lg font-bold", up ? "text-long" : "text-short")}>
          {formatPrice(price, market.priceDecimals)}
        </span>
        <span className="font-mono text-[11px] text-term-muted">
          {market.quote === "USDT" ? "USDT" : market.quote}
        </span>
      </div>
      <Stat
        label="Variação 24h"
        value={ticker ? `${up ? "+" : ""}${change.toFixed(2)}%` : "--"}
        className={up ? "text-long" : "text-short"}
      />
      <Stat label="Máxima 24h" value={formatPrice(ticker?.high, market.priceDecimals)} />
      <Stat label="Mínima 24h" value={formatPrice(ticker?.low, market.priceDecimals)} />
      {market.category === "crypto" ? (
        <>
          <Stat label="Volume 24h (USDT)" value={formatCompact(ticker?.volume)} />
          <Stat label="Spread" value={formatPrice(spread, market.priceDecimals)} />
        </>
      ) : (
        <>
          <Stat label="Spread" value={formatPrice(spread, market.priceDecimals)} />
          <Stat label="Tamanho do contrato" value={`${market.contractSize.toLocaleString("pt-BR")} ${market.base}`} />
        </>
      )}
      <Stat label="Alavancagem máx." value={`${market.maxLeverage}x`} />
    </div>
  )
}
