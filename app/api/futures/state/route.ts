import { NextResponse, type NextRequest } from "next/server"
import { loadState, sweep, TradingError } from "@/lib/futures/engine"
import { errorResponse, requireUser } from "@/lib/futures/http"
import type { FuturesState } from "@/lib/futures/types"

export const dynamic = "force-dynamic"

const empty = (account: "demo" | "real", configured: boolean): FuturesState => ({
  configured,
  authenticated: false,
  account,
  balance: 0,
  balances: { real: 0, demo: 0 },
  positions: [],
  openOrders: [],
  orderHistory: [],
  fills: [],
  closedPositions: [],
})

export async function GET(request: NextRequest) {
  const account = request.nextUrl.searchParams.get("account") === "demo" ? "demo" : "real"
  try {
    const user = await requireUser()
    // Cada consulta do usuario tambem processa suas ordens pendentes, TP/SL e liquidacoes.
    await sweep(user.id).catch((e) => console.error("[futures] sweep falhou:", (e as Error).message))
    const state = await loadState(user.id, account === "demo")
    const body: FuturesState = { configured: true, authenticated: true, email: user.email, account, ...state }
    return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } })
  } catch (e) {
    if (e instanceof TradingError && e.status === 401) return NextResponse.json(empty(account, true))
    if (e instanceof TradingError && e.status === 503) {
      return NextResponse.json({ ...empty(account, false), error: e.message })
    }
    return errorResponse(e)
  }
}
