"use client"

import { useEffect, useMemo, useState } from "react"
import { ChevronDown, Search, Star } from "lucide-react"
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
import type { DerivativesInfo, Ticker } from "@/hooks/use-futures"

interface TickerBarProps {
  market: FuturesMarket
  ticker: Ticker | null
  last: number | null
  tickers: Record<string, Ticker>
  deriv?: DerivativesInfo
  onSelect: (symbol: string) => void
}

type SelectorTab = MarketCategory | "fav"
const FAV_KEY = "kb:fav-markets"

function useFavorites() {
  const [favs, setFavs] = useState<string[]>([])
  useEffect(() => {
    try {
      setFavs(JSON.parse(localStorage.getItem(FAV_KEY) ?? "[]"))
    } catch {
      setFavs([])
    }
  }, [])
  const toggle = (symbol: string) =>
    setFavs((prev) => {
      const next = prev.includes(symbol) ? prev.filter((s) => s !== symbol) : [...prev, symbol]
      localStorage.setItem(FAV_KEY, JSON.stringify(next))
      return next
    })
  return { favs, toggle }
}

function MarketSelector({ market, tickers, onSelect }: Pick<TickerBarProps, "market" | "tickers" | "onSelect">) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState<SelectorTab>(market.category)
  const { favs, toggle } = useFavorites()

  const list = useMemo(() => {
    const q = query.trim().toUpperCase()
    return MARKETS.filter((m) =>
      q
        ? m.symbol.includes(q) || m.name.toUpperCase().includes(q)
        : category === "fav"
          ? favs.includes(m.symbol)
          : m.category === category,
    )
  }, [query, category, favs])

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
              <button
                role="tab"
                aria-selected={category === "fav"}
                onClick={() => setCategory("fav")}
                className={cn(
                  "flex items-center gap-1 border-b-2 pb-1 font-medium",
                  category === "fav" ? "border-primary text-term-text" : "border-transparent text-term-muted",
                )}
              >
                <Star className="size-3.5" aria-hidden="true" />
                Favoritos
              </button>
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
          {list.length === 0 && (
            <li className="px-3 py-6 text-center text-xs text-term-muted">
              {category === "fav" && !query ? "Toque na estrela para adicionar favoritos." : "Nenhum mercado encontrado."}
            </li>
          )}
          {list.map((m) => {
            const t = tickers[m.symbol]
            const up = (t?.changePercent ?? 0) >= 0
            const fav = favs.includes(m.symbol)
            return (
              <li key={m.symbol} className="flex items-center">
                <button
                  onClick={() => toggle(m.symbol)}
                  aria-label={fav ? `Remover ${m.symbol} dos favoritos` : `Favoritar ${m.symbol}`}
                  aria-pressed={fav}
                  className="pl-3 text-term-muted hover:text-primary"
                >
                  <Star className={cn("size-3.5", fav && "fill-primary text-primary")} aria-hidden="true" />
                </button>
                <button
                  onClick={() => {
                    onSelect(m.symbol)
                    setOpen(false)
                    setQuery("")
                  }}
                  className={cn(
                    "grid w-full grid-cols-[1fr_auto_auto] items-center gap-x-4 py-2 pl-2 pr-3 text-left text-sm hover:bg-term-line/60",
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

function useCountdown(target: number | undefined) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  if (!target) return "--:--:--"
  const s = Math.max(0, Math.floor((target - now) / 1000))
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`
}

export function TickerBar({ market, ticker, last, tickers, deriv, onSelect }: TickerBarProps) {
  const countdown = useCountdown(deriv?.nextFundingTime)
  const fundingPositive = (deriv?.fundingRate ?? 0) >= 0
  const price = last ?? ticker?.price ?? null
  const change = ticker?.changePercent ?? 0
  const up = change >= 0
  const spread = ticker && ticker.ask > 0 && ticker.bid > 0 ? Math.max(0, ticker.ask - ticker.bid) : null
  // Em cripto o spread costuma ser menor que o tick exibido (ex.: 0.01 em BTC), então ganha casas extras.
  const spreadDecimals =
    spread != null && spread > 0 && spread < 10 ** -market.priceDecimals
      ? Math.min(8, Math.ceil(-Math.log10(spread)) + 1)
      : market.priceDecimals

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
      <Stat label="Preço de marcação" value={formatPrice(deriv?.markPrice, market.priceDecimals)} />
      <Stat label="Preço de índice" value={formatPrice(deriv?.indexPrice, market.priceDecimals)} />
      <div className="flex shrink-0 flex-col leading-tight">
        <span className="text-[11px] text-term-muted">Financiamento / Contagem</span>
        <span className="font-mono text-xs font-medium">
          <span className={fundingPositive ? "text-long" : "text-short"}>
            {deriv ? `${(deriv.fundingRate * 100).toFixed(4)}%` : "--"}
          </span>
          <span className="text-term-text"> / {countdown}</span>
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
          <Stat
            label="Contratos em aberto"
            value={deriv?.openInterestUsd != null ? `${formatCompact(deriv.openInterestUsd)} USD` : "--"}
          />
          <Stat label="Spread" value={formatPrice(spread, spreadDecimals)} />
        </>
      ) : (
        <>
          <Stat label="Spread" value={formatPrice(spread, spreadDecimals)} />
          <Stat label="Tamanho do contrato" value={`${market.contractSize.toLocaleString("pt-BR")} ${market.base}`} />
        </>
      )}
      <Stat label="Alavancagem máx." value={`${market.maxLeverage}x`} />
    </div>
  )
}
