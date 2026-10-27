import { NextResponse, type NextRequest } from "next/server"
import { getHoldings, listLaunches, tradeInputSchema, tradeLaunch } from "@/lib/launches"
import { errorResponse, requireUser } from "@/lib/futures/http"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const launches = await listLaunches({ onlyVisible: true })
    const holdings = await requireUser()
      .then((u) => getHoldings(u.id))
      .catch(() => [])
    return NextResponse.json({ data: launches, holdings }, { headers: { "Cache-Control": "no-store" } })
  } catch {
    return NextResponse.json({ error: "Lançamentos indisponíveis" }, { status: 503 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser()
    const parsed = tradeInputSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 })
    }
    return NextResponse.json({ success: true, trade: await tradeLaunch(user.id, parsed.data) })
  } catch (e) {
    return errorResponse(e)
  }
}
