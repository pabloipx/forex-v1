import { multiAssetEngine, OTC_ASSETS } from "@/lib/price-engine/multi-asset-engine"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const timeframe = Number(searchParams.get("timeframe") || "60") as 60 | 300 | 600 | 900
    const symbol = searchParams.get("symbol") || "EURUSD_OTC"

    const validSymbol = OTC_ASSETS.find((a) => a.symbol === symbol)?.symbol || "EURUSD_OTC"
    const candles = multiAssetEngine.getHistory(validSymbol, timeframe)

    return Response.json(
      { symbol: validSymbol, timeframe, candles },
      { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } },
    )
  } catch {
    return Response.json({ symbol: "EURUSD_OTC", timeframe: 60, candles: [] })
  }
}
