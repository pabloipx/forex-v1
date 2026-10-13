import { NextResponse } from "next/server"
import { getAllTickers, type Ticker } from "@/lib/futures/prices"
import { ensureMarketSettings, withSpread } from "@/lib/futures/market-settings"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const [raw, settings] = await Promise.all([getAllTickers(), ensureMarketSettings()])
    const tickers: Record<string, Ticker> = {}
    for (const [symbol, t] of Object.entries(raw)) tickers[symbol] = withSpread(t, settings[symbol]?.spreadBps ?? 0)
    const disabled = Object.values(settings)
      .filter((s) => !s.enabled)
      .map((s) => s.symbol)
    return NextResponse.json({ tickers, disabled }, { headers: { "Cache-Control": "no-store" } })
  } catch {
    return NextResponse.json({ tickers: {}, disabled: [] }, { status: 503 })
  }
}
