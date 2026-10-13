import { multiAssetEngine, OTC_ASSETS } from "@/lib/price-engine/multi-asset-engine"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const timeframe = Number(searchParams.get("timeframe") || "60") as 60 | 300 | 600 | 900
    const symbol = searchParams.get("symbol") || "EURUSD_OTC"

    const validSymbol = OTC_ASSETS.find((a) => a.symbol === symbol)?.symbol || "EURUSD_OTC"
    const state = multiAssetEngine.getAssetState(validSymbol, timeframe)

    return Response.json(state, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    })
  } catch {
    // Retorna estado padrão em caso de erro
    return Response.json({
      symbol: "EURUSD_OTC",
      name: "EUR/USD OTC",
      price: 1.085,
      timestamp: Math.floor(Date.now() / 1000),
      candles: [],
      currentCandle: null,
      timeframe: 60,
    })
  }
}
