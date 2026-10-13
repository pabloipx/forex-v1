import { NextResponse, type NextRequest } from "next/server"
import { getMarket } from "@/lib/futures/markets"
import { INTERVALS, getCandles, type ChartInterval } from "@/lib/futures/candles"

export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const symbol = req.nextUrl.searchParams.get("symbol") ?? ""
  const interval = (req.nextUrl.searchParams.get("interval") ?? "15m") as ChartInterval
  const market = getMarket(symbol)
  if (!market) return NextResponse.json({ error: "Mercado inválido" }, { status: 400 })
  if (!INTERVALS.includes(interval)) return NextResponse.json({ error: "Intervalo inválido" }, { status: 400 })
  try {
    const candles = await getCandles(market, interval)
    return NextResponse.json({ candles })
  } catch {
    return NextResponse.json({ error: "Histórico indisponível no momento" }, { status: 502 })
  }
}
