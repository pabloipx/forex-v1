import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { setTrailing } from "@/lib/futures/engine"
import { errorResponse, requireUser } from "@/lib/futures/http"

const schema = z.object({
  positionId: z.string().uuid(),
  distance: z.number().finite().positive().nullable(),
})

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser()
    const parsed = schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 })
    const { positionId, distance } = parsed.data
    return NextResponse.json({ success: true, result: await setTrailing(user.id, positionId, distance) })
  } catch (e) {
    return errorResponse(e)
  }
}
