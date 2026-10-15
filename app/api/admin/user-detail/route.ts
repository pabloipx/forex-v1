import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { isAdminRequest, unauthorizedResponse } from "@/lib/admin/session"
import { errorResponse } from "@/lib/futures/http"
import { isTestModeEnabled } from "@/lib/futures/demo-session"
import { getUserDetail } from "@/lib/admin/user-detail"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  if (!(await isAdminRequest())) return unauthorizedResponse()
  const userId = z.string().uuid().safeParse(request.nextUrl.searchParams.get("userId"))
  if (!userId.success) return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 })
  if (isTestModeEnabled()) return NextResponse.json({ error: "Indisponível no modo de teste" }, { status: 400 })
  try {
    return NextResponse.json({ data: await getUserDetail(userId.data) })
  } catch (e) {
    return errorResponse(e)
  }
}
