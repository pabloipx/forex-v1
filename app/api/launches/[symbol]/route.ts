import { NextResponse } from "next/server"
import { getHoldings, getLaunchBySymbol, getPriceSeries } from "@/lib/launches"
import { requireUser } from "@/lib/futures/http"

export const dynamic = "force-dynamic"

export async function GET(_request: Request, { params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params
  try {
    const launch = await getLaunchBySymbol(symbol)
    if (!launch) return NextResponse.json({ error: "Moeda não encontrada" }, { status: 404 })
    const [history, holding] = await Promise.all([
      getPriceSeries(launch),
      requireUser()
        .then((u) => getHoldings(u.id))
        .then((list) => list.find((h) => h.launch_id === launch.id) ?? null)
        .catch(() => null),
    ])
    return NextResponse.json({ data: launch, history, holding }, { headers: { "Cache-Control": "no-store" } })
  } catch {
    return NextResponse.json({ error: "Moeda indisponível" }, { status: 503 })
  }
}
