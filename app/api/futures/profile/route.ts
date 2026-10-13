import { NextResponse, type NextRequest } from "next/server"
import { errorResponse, requireUser } from "@/lib/futures/http"
import { getProfile, updateProfile } from "@/lib/futures/profile"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const user = await requireUser()
    return NextResponse.json({ profile: await getProfile(user) })
  } catch (e) {
    return errorResponse(e)
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireUser()
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Corpo inválido" }, { status: 400 })
    return NextResponse.json({ profile: await updateProfile(user, body) })
  } catch (e) {
    return errorResponse(e)
  }
}
