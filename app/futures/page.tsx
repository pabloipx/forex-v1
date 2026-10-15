import type { Metadata } from "next"
import { cookies } from "next/headers"
import { FuturesTerminal } from "@/components/futures/terminal"
import { DEFAULT_SYMBOL, getMarket } from "@/lib/futures/markets"
import { TERM_THEME_COOKIE, parseTermTheme } from "@/lib/futures/term-theme"

export const metadata: Metadata = {
  title: "Derivativos — Futuros e Forex | Kryptobit",
  description: "Negocie futuros perpétuos de cripto, forex e metais com alavancagem, livro de ofertas e gráficos TradingView.",
}

export default async function FuturesPage({ searchParams }: { searchParams: Promise<{ symbol?: string }> }) {
  const [{ symbol }, cookieStore] = await Promise.all([searchParams, cookies()])
  const market = getMarket(symbol) ?? getMarket(DEFAULT_SYMBOL)!
  const theme = parseTermTheme(cookieStore.get(TERM_THEME_COOKIE)?.value)
  return <FuturesTerminal symbol={market.symbol} initialTheme={theme} />
}
