import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { setLeverage } from "@/lib/futures/engine"
import { errorResponse, requireUser } from "@/lib/futures/http"

const schema = z.object({
  positionId: z.string().uuid(),
  leverage: z.number().int().min(1).max(1000),
})

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser()
    const parsed = schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 })
    const { positionId, leverage } = parsed.data
    return NextResponse.json({ success: true, result: await setLeverage(user.id, positionId, leverage) })
  } catch (e) {
    return errorResponse(e)
  }
}
