"use client"

import { useCallback, useRef, useState } from "react"
import { TERM_THEME_COOKIE, type TermTheme } from "@/lib/futures/term-theme"
import { useRouter } from "next/navigation"
import { Toaster, toast } from "sonner"
import { MARKET_MAP } from "@/lib/futures/markets"
import type { AccountMode } from "@/lib/futures/types"
import { futuresApi, useDerivatives, useFuturesState, useTickers, useTradingPrefs } from "@/hooks/use-futures"
import { useMarketFeed } from "@/hooks/use-market-feed"
import { useTradeNotifications } from "@/hooks/use-trade-notifications"
import { cn } from "@/lib/utils"
import { AccountSummary } from "./account-summary"
import { DepthChart } from "./depth-chart"
import { TopNav } from "./top-nav"
import { TickerBar } from "./ticker-bar"
import { PriceChart } from "./price-chart"
import { OrderBookPanel } from "./order-book"
import { OrderPanel } from "./order-panel"
import { AccountTables } from "./account-tables"
import { RotateDevice } from "./rotate-device"

type ChartView = "candles" | "depth"

function ChartViewToggle({ value, onChange }: { value: ChartView; onChange: (v: ChartView) => void }) {
  const options: [ChartView, string][] = [
    ["candles", "Gráfico"],
    ["depth", "Profundidade"],
  ]
  return (
    <div role="tablist" aria-label="Visualização" className="flex gap-0.5 rounded-md bg-term-bg p-0.5">
      {options.map(([k, label]) => (
        <button
          key={k}
          role="tab"
          aria-selected={value === k}
          onClick={() => onChange(k)}
          className={cn(
            "rounded px-2 py-0.5 text-[11px] font-medium",
            value === k ? "bg-term-line text-term-text" : "text-term-muted hover:text-term-text",
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

export function FuturesTerminal({ symbol, initialTheme }: { symbol: string; initialTheme: TermTheme }) {
  const router = useRouter()
  const market = MARKET_MAP[symbol]
  const rootRef = useRef<HTMLDivElement>(null)
  const [theme, setTheme] = useState<TermTheme>(initialTheme)

  const toggleTheme = useCallback(() => {
    const next: TermTheme = theme === "light" ? "dark" : "light"
    const root = rootRef.current
    root?.classList.add("term-switching")
    setTheme(next)
    document.cookie = `${TERM_THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`
    requestAnimationFrame(() => requestAnimationFrame(() => root?.classList.remove("term-switching")))
  }, [theme])
  const [account, setAccount] = useState<AccountMode>("demo")
  const [limitPrice, setLimitPrice] = useState("")

  const [chartView, setChartView] = useState<ChartView>("candles")
  const tickers = useTickers()
  const derivs = useDerivatives()
  const { state, refresh } = useFuturesState(account)
  useTradeNotifications(state, derivs)

  const dragLine = async (positionId: string, kind: "tp" | "sl", price: number) => {
    const pos = state?.positions.find((p) => p.id === positionId)
    if (!pos) return
    const takeProfit = kind === "tp" ? price : (pos.take_profit ?? null)
    const stopLoss = kind === "sl" ? price : (pos.stop_loss ?? null)
    try {
      await futuresApi.setTpSl(positionId, takeProfit, stopLoss)
      toast.success(`${kind === "tp" ? "Take profit" : "Stop loss"} movido para ${price}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível mover a linha")
    } finally {
      refresh()
    }
  }
  const prefs = useTradingPrefs(!!state?.authenticated)
  const [prefsApplied, setPrefsApplied] = useState(false)
  if (prefs && !prefsApplied) {
    setPrefsApplied(true)
    setAccount(prefs.defaultAccount)
  }
  const feed = useMarketFeed(market, tickers[symbol])
  const ticker = feed.ticker ?? tickers[symbol] ?? null
  const last = feed.last ?? ticker?.price ?? null

  const selectMarket = (s: string) => {
    setLimitPrice("")
    router.replace(`/futures?symbol=${s}`, { scroll: false })
  }

  return (
    <div
      ref={rootRef}
      className={cn(
        "flex min-h-dvh flex-col bg-term-bg text-term-text lg:h-dvh phone:h-dvh phone:min-h-0 phone:overflow-hidden",
        theme === "light" ? "term-light" : "term-dark",
      )}
    >
      <RotateDevice />
      <TopNav
        theme={theme}
        onToggleTheme={toggleTheme}
        account={account}
        onAccountChange={setAccount}
        authenticated={!!state?.authenticated}
        email={state?.email}
        balances={state?.balances ?? { real: 0, demo: 0 }}
      />
      <main className="flex min-h-0 flex-1 flex-col gap-px bg-term-bg lg:flex-row phone:flex-row phone-portrait:hidden">
        <div className="flex min-w-0 flex-1 flex-col gap-px phone:overflow-y-auto">
          <div className="flex min-h-0 flex-1 flex-col gap-px phone:h-[calc(100dvh-3rem)] phone:flex-none">
            <TickerBar market={market} ticker={ticker} last={last} tickers={tickers} deriv={derivs[symbol]} onSelect={selectMarket} />
            <div className="flex min-h-0 flex-1 flex-col gap-px md:flex-row phone:flex-row">
              <div className="flex h-[420px] min-w-0 flex-1 flex-col bg-term-panel md:h-auto phone:h-auto">
                {chartView === "candles" ? (
                  <PriceChart
                    market={market}
                    theme={theme}
                    last={last}
                    positions={state?.positions ?? []}
                    openOrders={state?.openOrders ?? []}
                    onLineDrag={dragLine}
                    toolbarExtra={<ChartViewToggle value={chartView} onChange={setChartView} />}
                  />
                ) : (
                  <>
                    <div className="flex h-10 shrink-0 items-center border-b border-term-line px-3">
                      <ChartViewToggle value={chartView} onChange={setChartView} />
                    </div>
                    <div className="min-h-0 flex-1">
                      <DepthChart market={market} feed={feed} />
                    </div>
                  </>
                )}
              </div>
              <div className="h-[560px] shrink-0 md:h-auto md:w-72 phone:h-auto phone:w-52">
                <OrderBookPanel market={market} feed={feed} onPriceClick={(p) => setLimitPrice(p.toFixed(market.priceDecimals))} />
              </div>
            </div>
          </div>
          <div className="h-72 shrink-0">
            <AccountTables
              state={state}
              account={account}
              marks={tickers}
              derivs={derivs}
              liveSymbol={symbol}
              livePrice={last}
              onChanged={() => refresh()}
            />
          </div>
        </div>
        <aside className="flex shrink-0 flex-col gap-px lg:w-80 lg:overflow-y-auto phone:w-64 phone:overflow-y-auto">
          <AccountSummary state={state} account={account} derivs={derivs} onChanged={() => refresh()} />
          <OrderPanel
            key={`${symbol}-${account}-${prefs?.defaultLeverage ?? 0}-${prefs?.defaultMarginMode ?? ""}`}
            prefs={prefs}
            market={market}
            account={account}
            balance={state?.balance ?? 0}
            authenticated={!!state?.authenticated}
            configured={state?.configured ?? true}
            lastPrice={last}
            price={limitPrice}
            onPriceChange={setLimitPrice}
            onSubmitted={() => refresh()}
          />
        </aside>
      </main>
      <Toaster theme={theme} position="top-center" richColors />
    </div>
  )
}
