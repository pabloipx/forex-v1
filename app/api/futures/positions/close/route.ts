import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { closePosition } from "@/lib/futures/engine"
import { errorResponse, requireUser } from "@/lib/futures/http"

const schema = z.object({
  positionId: z.string().uuid(),
  qty: z.number().finite().positive().nullish(),
  price: z.number().finite().positive().nullish(),
})

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser()
    const parsed = schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 })
    const { positionId, qty, price } = parsed.data
    const result = await closePosition(user.id, positionId, qty ?? undefined, price ?? undefined)
    return NextResponse.json({ success: true, result })
  } catch (e) {
    return errorResponse(e)
  }
}
