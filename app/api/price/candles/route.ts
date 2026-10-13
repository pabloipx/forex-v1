import { NextResponse } from "next/server"
import { getPriceManager } from "@/lib/price-engine/price-manager"
import { isRealSymbol } from "@/lib/price-engine/real-price-store"

/**
 * Get historical candles for a symbol and timeframe
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const symbol = searchParams.get("symbol")
    const timeframeParam = searchParams.get("timeframe")

    if (!symbol || !timeframeParam) {
      return NextResponse.json({ error: "Symbol and timeframe parameters required" }, { status: 400 })
    }

    const timeframe = Number(timeframeParam) as 60 | 300 | 600 | 900

    if (![60, 300, 600, 900].includes(timeframe)) {
      return NextResponse.json(
        { error: "Invalid timeframe. Must be 60, 300, 600, or 900" },
        { status: 400 },
      )
    }

    // Ativos de MERCADO ABERTO nao podem receber velas do gerador sintetico. O historico real
    // deles e servido por /api/market/crypto, que monta o OHLC a partir de ticks de mercado.
    if (isRealSymbol(symbol)) {
      return NextResponse.json(
        { error: "Use /api/market/crypto para ativos de mercado aberto" },
        { status: 400 },
      )
    }

    // OTC: motor deterministico atual, sintetico de proposito.
    const priceManager = getPriceManager()
    const candles = priceManager.getHistoricalCandles(symbol, timeframe)
    const currentCandle = priceManager.getCurrentCandle(symbol, timeframe)

    return NextResponse.json({
      symbol,
      timeframe,
      candles,
      currentCandle,
    })
  } catch (error) {
    console.error("[v0] Error fetching candles:", error)
    return NextResponse.json({ error: "Failed to fetch candles" }, { status: 500 })
  }
}
