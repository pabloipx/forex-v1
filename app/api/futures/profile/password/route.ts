import { NextResponse, type NextRequest } from "next/server"
import { errorResponse, requireUser } from "@/lib/futures/http"
import { changePassword } from "@/lib/futures/profile"

export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser()
    const body = (await request.json().catch(() => ({}))) as { currentPassword?: unknown; newPassword?: unknown }
    if (typeof body.currentPassword !== "string" || typeof body.newPassword !== "string") {
      return NextResponse.json({ error: "Informe a senha atual e a nova senha" }, { status: 400 })
    }
    await changePassword(user, body.currentPassword, body.newPassword)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return errorResponse(e)
  }
}
