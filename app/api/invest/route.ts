import { NextResponse, type NextRequest } from "next/server"
import { errorResponse, requireUser } from "@/lib/futures/http"
import {
  createInvestment,
  createInvestmentSchema,
  listInvestments,
  withdrawInvestment,
  withdrawInvestmentSchema,
} from "@/lib/investments"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const user = await requireUser()
    return NextResponse.json(
      { authenticated: true, investments: await listInvestments(user.id) },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch {
    return NextResponse.json({ authenticated: false, investments: [] }, { headers: { "Cache-Control": "no-store" } })
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
