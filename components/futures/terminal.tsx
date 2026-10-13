"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Toaster } from "sonner"
import { MARKET_MAP } from "@/lib/futures/markets"
import type { AccountMode } from "@/lib/futures/types"
import { useFuturesState, useTickers } from "@/hooks/use-futures"
import { useMarketFeed } from "@/hooks/use-market-feed"
import { TopNav } from "./top-nav"
import { TickerBar } from "./ticker-bar"
import { PriceChart } from "./price-chart"
import { OrderBookPanel } from "./order-book"
import { OrderPanel } from "./order-panel"
import { AccountTables } from "./account-tables"
import { RotateDevice } from "./rotate-device"

export function FuturesTerminal({ symbol }: { symbol: string }) {
  const router = useRouter()
  const market = MARKET_MAP[symbol]
  const [account, setAccount] = useState<AccountMode>("demo")
  const [limitPrice, setLimitPrice] = useState("")

  const tickers = useTickers()
  const { state, refresh } = useFuturesState(account)
  const feed = useMarketFeed(market, tickers[symbol])
  const ticker = feed.ticker ?? tickers[symbol] ?? null
  const last = feed.last ?? ticker?.price ?? null

  const selectMarket = (s: string) => {
    setLimitPrice("")
    router.replace(`/futures?symbol=${s}`, { scroll: false })
  }

  return (
    <div className="flex min-h-dvh flex-col bg-term-bg text-term-text lg:h-dvh phone:h-dvh phone:min-h-0 phone:overflow-hidden">
      <RotateDevice />
      <TopNav
        account={account}
        onAccountChange={setAccount}
        authenticated={!!state?.authenticated}
        email={state?.email}
        balances={state?.balances ?? { real: 0, demo: 0 }}
      />
      <main className="flex min-h-0 flex-1 flex-col gap-px bg-term-bg lg:flex-row phone:flex-row phone-portrait:hidden">
        <div className="flex min-w-0 flex-1 flex-col gap-px phone:overflow-y-auto">
          <div className="flex min-h-0 flex-1 flex-col gap-px phone:h-[calc(100dvh-3rem)] phone:flex-none">
            <TickerBar market={market} ticker={ticker} last={last} tickers={tickers} onSelect={selectMarket} />
            <div className="flex min-h-0 flex-1 flex-col gap-px md:flex-row phone:flex-row">
              <div className="h-[420px] min-w-0 flex-1 bg-term-panel md:h-auto phone:h-auto">
                <PriceChart
                  market={market}
                  last={last}
                  positions={state?.positions ?? []}
                  openOrders={state?.openOrders ?? []}
                />
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
              liveSymbol={symbol}
              livePrice={last}
              onChanged={() => refresh()}
            />
          </div>
        </div>
        <aside className="shrink-0 lg:w-80 phone:w-64 phone:overflow-y-auto">
          <OrderPanel
            key={`${symbol}-${account}`}
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
      <Toaster theme="dark" position="top-center" richColors />
    </div>
  )
}
