import type { Metadata } from "next"
import { FuturesTerminal } from "@/components/futures/terminal"
import { DEFAULT_SYMBOL, getMarket } from "@/lib/futures/markets"

export const metadata: Metadata = {
  title: "Derivativos — Futuros e Forex | Kryptobit",
  description: "Negocie futuros perpétuos de cripto, forex e metais com alavancagem, livro de ofertas e gráficos TradingView.",
}

export default async function FuturesPage({ searchParams }: { searchParams: Promise<{ symbol?: string }> }) {
  const { symbol } = await searchParams
  const market = getMarket(symbol) ?? getMarket(DEFAULT_SYMBOL)!
  return <FuturesTerminal symbol={market.symbol} />
}
