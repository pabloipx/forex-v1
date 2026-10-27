"use client"

import { useEffect, useLayoutEffect, useState } from "react"
import Link from "next/link"
import useSWR from "swr"
import { Toaster } from "sonner"
import { ArrowLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import type { TermTheme } from "@/lib/futures/term-theme"
import { useFuturesState } from "@/hooks/use-futures"
import { LaunchChart, type PricePoint } from "./launch-chart"
import { coinTicker, fmtUsd, LaunchTrade, type Holding, type Launch } from "./launch-trade"

interface LaunchDetail {
  data: Launch & { website_url?: string | null }
  history: PricePoint[]
  holding: Holding | null
}

const fetcher = async (url: string): Promise<LaunchDetail> => {
  const res = await fetch(url)
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? "Moeda indisponível")
  return json
}

function useNow() {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])
  return now
}

function Countdown({ ms }: { ms: number }) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const parts: [number, string][] = [
    [Math.floor(s / 86400), "dias"],
    [Math.floor((s % 86400) / 3600), "horas"],
    [Math.floor((s % 3600) / 60), "min"],
    [s % 60, "seg"],
  ]
  return (
    <div className="grid grid-cols-4 gap-2" role="timer" aria-label="Tempo até o lançamento">
      {parts.map(([v, label]) => (
        <div key={label} className="flex flex-col items-center rounded-md bg-term-bg py-2">
          <span className="font-mono text-xl font-semibold tabular-nums">{String(v).padStart(2, "0")}</span>
          <span className="text-[11px] text-term-muted">{label}</span>
        </div>
      ))}
    </div>
  )
}

export function LaunchView({ symbol, initialTheme }: { symbol: string; initialTheme: TermTheme }) {
  const theme = initialTheme
  const { data, error, isLoading, mutate } = useSWR(`/api/launches/${symbol}`, fetcher, { refreshInterval: 5000 })
  const { state } = useFuturesState("real")
  const now = useNow()

  useLayoutEffect(() => {
    const cls = theme === "light" ? "term-light" : "term-dark"
    document.body.classList.add(cls)
    return () => document.body.classList.remove(cls)
  }, [theme])

  const coin = data?.data
  const launchMs = coin?.launch_at ? new Date(coin.launch_at).getTime() : null
  const isPresale = coin?.phase === "presale"

  useEffect(() => {
    if (isPresale && launchMs && launchMs <= now) mutate()
  }, [isPresale, launchMs, now, mutate])

  const price = coin?.trade_price_usd ?? null
  const presale = coin?.presale_price_usd ?? null
  const change = !isPresale && price != null && presale ? ((price - presale) / presale) * 100 : null
  const rising = change == null || change >= 0
  const holding = data?.holding
  const holdingValue = holding && price != null ? holding.qty * price : 0
  const holdingPnl = holding ? holdingValue - holding.invested_usd : 0

  return (
    <div className={cn("term-root min-h-dvh bg-term-bg text-term-text", theme === "light" ? "term-light" : "term-dark")}>
      <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b border-term-line bg-term-panel px-2">
        <Link
          href="/futures"
          aria-label="Voltar ao terminal"
          className="flex size-11 items-center justify-center rounded-md text-term-muted hover:text-term-text"
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
        </Link>
        {coin && (
          <div className="flex min-w-0 items-center gap-2.5">
            <img
              src={coin.icon_url || "/placeholder.svg?height=32&width=32&query=coin"}
              alt=""
              width={32}
              height={32}
              className="size-8 shrink-0 rounded-full object-cover"
            />
            <div className="flex min-w-0 flex-col leading-tight">
              <h1 className="truncate text-sm font-semibold">{coin.name}</h1>
              <span className="text-[11px] text-term-muted">{coin.symbol}</span>
            </div>
          </div>
        )}
      </header>

      {isLoading && <p className="px-4 py-16 text-center text-sm text-term-muted">Carregando...</p>}
      {error && !coin && (
        <div className="flex flex-col items-center gap-4 px-4 py-16 text-center">
          <p className="text-sm text-term-muted">{error.message}</p>
          <Link href="/futures" className="text-sm font-medium text-primary">
            Voltar ao terminal
          </Link>
        </div>
      )}

      {coin && (
        <main className="mx-auto flex w-full max-w-6xl flex-col gap-3 p-3 lg:flex-row lg:items-start">
          <section className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex flex-col gap-1 rounded-lg border border-term-line bg-term-panel p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-term-muted">{isPresale ? "Preço de pré-venda" : "Preço atual"}</span>
                <span
                  className={cn(
                    "rounded px-2 py-0.5 text-[11px] font-semibold",
                    isPresale ? "bg-primary/10 text-primary" : "bg-term-up/10 text-term-up",
                  )}
                >
                  {isPresale ? "Pré-venda" : "Ao vivo"}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className={cn("font-mono text-3xl font-semibold tabular-nums", !isPresale && (rising ? "text-term-up" : "text-term-down"))}>
                  {price != null ? `US$ ${fmtUsd(price)}` : "—"}
                </span>
                {change != null && (
                  <span className={cn("font-mono text-sm tabular-nums", rising ? "text-term-up" : "text-term-down")}>
                    {rising ? "+" : ""}
                    {change.toFixed(2)}%
                  </span>
                )}
              </div>
              {!isPresale && presale != null && (
                <span className="text-xs text-term-muted">Pré-venda: US$ {fmtUsd(presale)}</span>
              )}
            </div>

            <div className="h-96 overflow-hidden rounded-lg border border-term-line bg-term-panel sm:h-[28rem]">
              <LaunchChart points={data.history} symbol={symbol} theme={theme} />
            </div>
            {isPresale && presale != null && (
              <p className="-mt-1 text-xs text-term-muted">
                Na pré-venda a compra é sempre a US$ {fmtUsd(presale)} por moeda.
              </p>
            )}

            {isPresale && launchMs && (
              <div className="flex flex-col gap-3 rounded-lg border border-term-line bg-term-panel p-4">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold">Lançamento oficial</span>
                  <span className="text-xs text-term-muted text-pretty">
                    {new Date(launchMs).toLocaleString("pt-BR", {
                      dateStyle: "full",
                      timeStyle: "short",
                      timeZone: "America/Sao_Paulo",
                    })}{" "}
                    (Brasília)
                  </span>
                </div>
                <Countdown ms={launchMs - now} />
              </div>
            )}

            {coin.description && (
              <p className="rounded-lg border border-term-line bg-term-panel p-4 text-sm leading-relaxed text-term-muted text-pretty">
                {coin.description}
              </p>
            )}
          </section>

          <aside className="flex w-full flex-col gap-3 lg:sticky lg:top-17 lg:w-80">
            {holding && holding.qty > 0 && (
              <div className="flex flex-col gap-2 rounded-lg border border-term-line bg-term-panel p-4 text-sm">
                <span className="text-xs text-term-muted">Suas moedas</span>
                <span className="font-mono text-lg font-semibold tabular-nums">
                  {holding.qty.toLocaleString("pt-BR", { maximumFractionDigits: 6 })} {coinTicker(coin.symbol)}
                </span>
                <div className="flex justify-between text-xs">
                  <span className="text-term-muted">Investido</span>
                  <span className="font-mono tabular-nums">US$ {fmtUsd(holding.invested_usd)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-term-muted">Valor atual</span>
                  <span className="font-mono tabular-nums">US$ {fmtUsd(holdingValue)}</span>
                </div>
                {!isPresale && (
                  <div className="flex justify-between text-xs">
                    <span className="text-term-muted">Resultado</span>
                    <span className={cn("font-mono tabular-nums", holdingPnl >= 0 ? "text-term-up" : "text-term-down")}>
                      {holdingPnl >= 0 ? "+" : "-"}US$ {fmtUsd(Math.abs(holdingPnl))}
                    </span>
                  </div>
                )}
              </div>
            )}
            <LaunchTrade
              key={coin.phase}
              coin={coin}
              holding={holding}
              balance={state?.authenticated ? (state.balance ?? 0) : undefined}
              authenticated={state ? !!state.authenticated : undefined}
              onDone={() => mutate()}
            />
          </aside>
        </main>
      )}
      <Toaster theme={theme} position="top-center" richColors />
    </div>
  )
}
