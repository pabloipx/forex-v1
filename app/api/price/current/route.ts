import { NextResponse } from "next/server"
import { getPriceManager } from "@/lib/price-engine/price-manager"
import { isRealSymbol } from "@/lib/price-engine/real-price-store"
import { getRealPriceAt } from "@/lib/price-engine/real-quote"

/**
 * Get current price for a symbol
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const symbol = searchParams.get("symbol")

    if (!symbol) {
      return NextResponse.json({ error: "Symbol parameter required" }, { status: 400 })
    }

    // Ativos de MERCADO ABERTO nunca podem ser servidos pelo gerador sintetico do
    // price-manager: ele produz uma serie de senos ancorada num preco base, sem relacao com o
    // mercado. Para esses simbolos a cotacao vem da fonte real.
    if (isRealSymbol(symbol)) {
      const real = await getRealPriceAt(symbol, Date.now())
      if (real === null) {
        return NextResponse.json({ error: "Cotacao real indisponivel" }, { status: 503 })
      }
      return NextResponse.json({
        symbol,
        price: real,
        source: "real",
        timestamp: Math.floor(Date.now() / 1000),
      })
    }

    // OTC: motor deterministico atual, sintetico de proposito.
    const priceManager = getPriceManager()
    const currentPrice = priceManager.getCurrentPrice(symbol)

    if (currentPrice === null) {
      return NextResponse.json({ error: "Symbol not found" }, { status: 404 })
    }

    return NextResponse.json({
      symbol,
      price: currentPrice,
      timestamp: Math.floor(Date.now() / 1000),
    })
  } catch (error) {
    console.error("[v0] Error fetching current price:", error)
    return NextResponse.json({ error: "Failed to fetch price" }, { status: 500 })
  }
}
