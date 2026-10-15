import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { closeAllPositions } from "@/lib/futures/engine"
import { errorResponse, requireUser } from "@/lib/futures/http"

const schema = z.object({ account: z.enum(["real", "demo"]) })

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser()
    const parsed = schema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) return NextResponse.json({ error: "Dados inválidos" }, { status: 400 })
    return NextResponse.json({ success: true, result: await closeAllPositions(user.id, parsed.data.account === "demo") })
  } catch (e) {
    return errorResponse(e)
  }
}
