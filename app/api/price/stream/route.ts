import { NextResponse } from "next/server"
import { getGlobalPriceEngine } from "@/lib/price-engine/global-price-engine"

export const dynamic = "force-dynamic"

// Retorna preço atual - não usa SSE em serverless
export async function GET() {
  try {
    const engine = getGlobalPriceEngine()
    const price = engine.getCurrentPrice()
    const currentCandle = engine.getCurrentCandle(60)

    return NextResponse.json({
      success: true,
      symbol: "OTC_EURUSD",
      price,
      timestamp: Math.floor(Date.now() / 1000),
      currentCandle,
    })
  } catch {
    return NextResponse.json({
      success: true,
      symbol: "OTC_EURUSD",
      price: 1.085,
      timestamp: Math.floor(Date.now() / 1000),
    })
  }
}
