import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { transferFunds } from "@/lib/futures/engine"
import { errorResponse, requireUser } from "@/lib/futures/http"

const schema = z.object({
  direction: z.enum(["spot_to_futures", "futures_to_spot"]),
  amount: z.number().finite().positive().max(1_000_000_000),
})

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser()
    const parsed = schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 })
    const { direction, amount } = parsed.data
    return NextResponse.json({ success: true, result: await transferFunds(user.id, direction, amount) })
  } catch (e) {
    return errorResponse(e)
  }
}
