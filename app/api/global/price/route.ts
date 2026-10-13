import { globalPriceEngine } from "@/lib/price-engine/global-price-engine"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    return Response.json({
      symbol: "OTC_EURUSD",
      price: globalPriceEngine.getCurrentPrice(),
      timestamp: globalPriceEngine.getLastTickTime(),
    }, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    })
  } catch {
    return Response.json({
      symbol: "OTC_EURUSD",
      price: 1.085,
      timestamp: Math.floor(Date.now() / 1000),
    })
  }
}
