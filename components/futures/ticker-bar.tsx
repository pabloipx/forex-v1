"use client"

import { useEffect, useMemo, useState } from "react"
import useSWR, { mutate as globalMutate } from "swr"
import { toast } from "sonner"
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
import { AssetIcon } from "./asset-icon"

interface TickerBarProps {
  market: FuturesMarket
  ticker: Ticker | null
  last: number | null
  tickers: Record<string, Ticker>
  deriv?: DerivativesInfo
  onSelect: (symbol: string) => void
}

type SelectorTab = MarketCategory | "fav" | "launch"
const FAV_KEY = "kb:fav-markets"

interface Launch {
  id: string
  symbol: string
  name: string
  description: string | null
  icon_url: string | null
  launch_at: string | null
  presale_price_usd: number | null
  price_usd: number | null
  phase: "presale" | "live" | "ended"
  trade_price_usd: number | null
}

interface Holding {
  launch_id: string
  qty: number
  invested_usd: number
}

interface LaunchesResponse {
  data: Launch[]
  holdings: Holding[]
}

const launchFetcher = (url: string): Promise<LaunchesResponse> =>
  fetch(url).then((r) => (r.ok ? r.json() : { data: [], holdings: [] }))

const fmtUsd = (v: number, max = 2) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: max })

function useNow(enabled: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!enabled) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [enabled])
  return now
}

function countdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d > 0 ? `${d}d ` : ""}${pad(h)}h ${pad(m)}m ${pad(s % 60)}s`
}

function LaunchTrade({ coin, holding, onDone }: { coin: Launch; holding?: Holding; onDone: () => void }) {
  const [side, setSide] = useState<"buy" | "sell">("buy")
  const [value, setValue] = useState("")
  const [busy, setBusy] = useState(false)
  const price = coin.trade_price_usd ?? 0
  const isPresale = coin.phase === "presale"
  const amount = Number(value.replace(",", "."))
  const valid = Number.isFinite(amount) && amount > 0
  const preview = side === "buy" ? (valid && price ? amount / price : 0) : valid ? amount * price : 0

  const submit = async () => {
    if (!valid || busy) return
    setBusy(true)
    try {
      const res = await fetch("/api/launches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ launch_id: coin.id, side, value: amount }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Não foi possível concluir")
      toast.success(
        side === "buy"
          ? `Compra de ${json.trade.qty.toLocaleString("pt-BR", { maximumFractionDigits: 6 })} ${coin.symbol.replace("USDT", "")} concluída`
          : `Venda concluída: US$ ${fmtUsd(json.trade.amount)}`,
      )
      setValue("")
      await Promise.all([globalMutate("/api/launches"), globalMutate("/api/futures/state?account=real")])
      onDone()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-3 mt-1 flex flex-col gap-3 rounded-lg border border-term-line bg-term-bg p-3">
      {holding && holding.qty > 0 && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-term-muted">Você tem</span>
          <span className="font-mono tabular-nums">
            {holding.qty.toLocaleString("pt-BR", { maximumFractionDigits: 6 })} · US$ {fmtUsd(holding.qty * price)}
          </span>
        </div>
      )}
      {!isPresale && (
        <div role="radiogroup" aria-label="Operação" className="grid grid-cols-2 gap-1 rounded-md bg-term-line/40 p-1">
          {(["buy", "sell"] as const).map((s) => (
            <button
              key={s}
              role="radio"
              aria-checked={side === s}
              onClick={() => {
                setSide(s)
                setValue("")
              }}
              className={cn(
                "min-h-10 rounded text-sm font-semibold",
                side === s ? (s === "buy" ? "bg-up text-background" : "bg-down text-background") : "text-term-muted",
              )}
            >
              {s === "buy" ? "Comprar" : "Vender"}
            </button>
          ))}
        </div>
      )}
      <label className="flex flex-col gap-1.5 text-xs text-term-muted">
        {side === "buy" ? "Valor (USD)" : "Quantidade"}
        <input
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) submit()
          }}
          placeholder={side === "buy" ? "100,00" : "0,0"}
          className="h-11 rounded-md border border-term-line bg-term-panel px-3 font-mono text-base text-term-text outline-none focus:border-primary"
        />
      </label>
      {side === "sell" && holding && (
        <button onClick={() => setValue(String(holding.qty))} className="-mt-2 self-start text-xs text-primary">
          Vender tudo
        </button>
      )}
      <p className="text-xs text-term-muted">
        {side === "buy"
          ? `Você recebe ≈ ${preview.toLocaleString("pt-BR", { maximumFractionDigits: 6 })} ${coin.symbol.replace("USDT", "")}`
          : `Você recebe ≈ US$ ${fmtUsd(preview)}`}
        {" · "}preço US$ {fmtUsd(price)}
      </p>
      <button
        onClick={submit}
        disabled={!valid || busy}
        className={cn(
          "min-h-11 rounded-md text-sm font-semibold text-background disabled:opacity-50",
          side === "buy" ? "bg-up" : "bg-down",
        )}
      >
        {busy ? "Processando..." : side === "buy" ? (isPresale ? "Comprar na pré-venda" : "Comprar") : "Vender"}
      </button>
      {isPresale && (
        <p className="text-[11px] leading-relaxed text-term-muted">
          Venda liberada após o lançamento. O valor é debitado do seu saldo real.
        </p>
      )}
    </div>
  )
}

function UpcomingLaunches() {
  const { data, isLoading, mutate } = useSWR("/api/launches", launchFetcher, { refreshInterval: 10_000 })
  const [open, setOpen] = useState<string | null>(null)
  const coins = data?.data ?? []
  const now = useNow(coins.some((c) => c.phase === "presale" && c.launch_at))

  useEffect(() => {
    if (coins.some((c) => c.phase === "presale" && c.launch_at && new Date(c.launch_at).getTime() <= now)) mutate()
  }, [coins, now, mutate])

  if (isLoading) return <p className="px-3 py-6 text-center text-xs text-term-muted">Carregando...</p>
  if (!coins.length) return <p className="px-3 py-6 text-center text-xs text-term-muted">Nenhum lançamento previsto.</p>

  return (
    <ul className="max-h-[28rem] overflow-y-auto pb-3">
      {coins.map((coin) => {
        const holding = data?.holdings.find((h) => h.launch_id === coin.id)
        const isPresale = coin.phase === "presale"
        const expanded = open === coin.id
        return (
          <li key={coin.id} className="flex flex-col pb-2">
            <button
              onClick={() => setOpen(expanded ? null : coin.id)}
              aria-expanded={expanded}
              className="flex min-h-14 items-center gap-2.5 px-3 py-2.5 text-left text-sm hover:bg-term-line/20"
            >
              <img
                src={coin.icon_url || "/placeholder.svg?height=32&width=32&query=coin"}
                alt=""
                width={32}
                height={32}
                className="size-8 shrink-0 rounded-full object-cover"
              />
              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="font-semibold">{coin.name}</span>
                <span className="text-[11px] text-term-muted">
                  {coin.symbol}
                  {coin.trade_price_usd != null && ` · US$ ${fmtUsd(coin.trade_price_usd)}`}
                </span>
              </span>
              <span className="flex flex-col items-end gap-0.5">
                <span
                  className={cn(
                    "rounded px-2 py-0.5 text-[11px] font-semibold",
                    isPresale ? "bg-primary/10 text-primary" : "bg-up/10 text-up",
                  )}
                >
                  {isPresale ? "Pré-venda" : "Ao vivo"}
                </span>
                {isPresale && coin.launch_at && (
                  <span className="font-mono text-[10px] tabular-nums text-term-muted">
                    {countdown(new Date(coin.launch_at).getTime() - now)}
                  </span>
                )}
              </span>
            </button>
            {expanded && (
              <>
                {coin.description && (
                  <p className="px-3 pb-2 text-xs leading-relaxed text-term-muted text-pretty">{coin.description}</p>
                )}
                {isPresale && coin.launch_at && (
                  <p className="px-3 pb-1 text-[11px] text-term-muted">
                    Lançamento:{" "}
                    {new Date(coin.launch_at).toLocaleString("pt-BR", {
                      dateStyle: "full",
                      timeStyle: "short",
                      timeZone: "America/Sao_Paulo",
                    })}{" "}
                    (Brasília)
                  </p>
                )}
                <LaunchTrade coin={coin} holding={holding} onDone={() => mutate()} />
              </>
            )}
          </li>
        )
      })}
    </ul>
  )
}

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
        <button
          aria-label={`Selecionar mercado, atual ${market.symbol}`}
          className="group flex items-center gap-2.5 rounded-lg py-1 pl-1 pr-2 text-left transition-colors hover:bg-term-line/60"
        >
          <AssetIcon market={market} size={32} />
          <span className="flex flex-col gap-0.5 leading-tight">
            <span className="flex items-center gap-1 text-base font-bold tracking-tight text-term-text">
              {market.symbol}
              <ChevronDown
                className={cn("size-4 text-term-muted transition-transform duration-200", open && "rotate-180")}
                aria-hidden="true"
              />
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-term-muted">
              <span className="rounded bg-primary/10 px-1.5 py-px font-semibold text-primary">
                {market.category === "crypto" ? "Perpétuo" : market.category === "metals" ? "Metal" : "Forex"}
              </span>
              <span className="truncate">{market.name}</span>
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
            <div role="tablist" className="-mx-3 mt-3 flex gap-4 overflow-x-auto whitespace-nowrap px-3 text-sm [scrollbar-width:none]">
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
              <button
                role="tab"
                aria-selected={category === "launch"}
                onClick={() => setCategory("launch")}
                className={cn(
                  "border-b-2 pb-1 font-medium",
                  category === "launch" ? "border-primary text-term-text" : "border-transparent text-term-muted",
                )}
              >
                Lançamentos
              </button>
            </div>
          )}
        </div>
        {category === "launch" && !query ? (
          <>
            <div className="grid grid-cols-[1fr_auto] gap-x-4 px-3 py-1.5 text-[11px] text-term-muted">
              <span>Moeda</span>
              <span className="text-right">Status</span>
            </div>
            <UpcomingLaunches />
          </>
        ) : (
        <>
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
                  <span className="flex min-w-0 items-center gap-2.5">
                    <AssetIcon market={m} size={24} />
                    <span className="flex flex-col leading-tight">
                      <span className="font-semibold">{m.symbol}</span>
                      <span className="text-[11px] text-term-muted">{m.maxLeverage}x</span>
                    </span>
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
        </>
        )}
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
