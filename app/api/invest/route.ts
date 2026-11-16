import { NextResponse, type NextRequest } from "next/server"
import { errorResponse, requireUser } from "@/lib/futures/http"
import {
  createInvestment,
  createInvestmentSchema,
  listInvestments,
  withdrawInvestment,
  withdrawInvestmentSchema,
} from "@/lib/investments"
import { getInvestConfig } from "@/lib/invest-rates"
import type { InvestRates, InvestTerms } from "@/lib/invest-schedule"

export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" }

async function safeConfig(): Promise<{ rates: InvestRates; terms: InvestTerms }> {
  try {
    return await getInvestConfig()
  } catch (e) {
    console.error("[invest] failed to load rates", e)
    return { rates: {}, terms: {} }
  }
}

export async function GET() {
  const configPromise = safeConfig()
  try {
    const user = await requireUser()
    const [investments, config] = await Promise.all([listInvestments(user.id), configPromise])
    return NextResponse.json({ authenticated: true, investments, ...config }, { headers: NO_STORE })
  } catch {
    return NextResponse.json({ authenticated: false, investments: [], ...(await configPromise) }, { headers: NO_STORE })
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
