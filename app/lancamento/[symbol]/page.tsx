import type { Metadata } from "next"
import { cookies } from "next/headers"
import { LaunchView } from "@/components/launch/launch-view"
import { TERM_THEME_COOKIE, parseTermTheme } from "@/lib/futures/term-theme"

export async function generateMetadata({ params }: { params: Promise<{ symbol: string }> }): Promise<Metadata> {
  const { symbol } = await params
  return {
    title: `${symbol.toUpperCase()} — Lançamento | Kryptobit`,
    description: "Gráfico, pré-venda e negociação da moeda em lançamento.",
  }
}

export default async function LaunchPage({ params }: { params: Promise<{ symbol: string }> }) {
  const [{ symbol }, cookieStore] = await Promise.all([params, cookies()])
  const theme = parseTermTheme(cookieStore.get(TERM_THEME_COOKIE)?.value)
  return <LaunchView symbol={symbol.toUpperCase()} initialTheme={theme} />
}
