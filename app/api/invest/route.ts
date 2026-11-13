import { NextResponse, type NextRequest } from "next/server"
import { errorResponse, requireUser } from "@/lib/futures/http"
import {
  createInvestment,
  createInvestmentSchema,
  listInvestments,
  withdrawInvestment,
  withdrawInvestmentSchema,
} from "@/lib/investments"
import { getInvestRates } from "@/lib/invest-rates"
import type { InvestRates } from "@/lib/invest-schedule"

export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" }

async function safeRates(): Promise<InvestRates> {
  try {
    return await getInvestRates()
  } catch (e) {
    console.error("[invest] failed to load rates", e)
    return {}
  }
}

export async function GET() {
  const ratesPromise = safeRates()
  try {
    const user = await requireUser()
    const [investments, rates] = await Promise.all([listInvestments(user.id), ratesPromise])
    return NextResponse.json({ authenticated: true, investments, rates }, { headers: NO_STORE })
  } catch {
    return NextResponse.json({ authenticated: false, investments: [], rates: await ratesPromise }, { headers: NO_STORE })
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser()
    const body = await request.json().catch(() => null)
    if (body?.action === "withdraw") {
      const parsed = withdrawInvestmentSchema.safeParse(body)
      if (!parsed.success) return NextResponse.json({ error: "Investimento inválido" }, { status: 400 })
      return NextResponse.json({ success: true, result: await withdrawInvestment(user.id, parsed.data.id) })
    }
    const parsed = createInvestmentSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Valor inválido" }, { status: 400 })
    }
    return NextResponse.json({ success: true, result: await createInvestment(user.id, parsed.data.amount, parsed.data.asset) })
  } catch (e) {
    return errorResponse(e)
  }
}
