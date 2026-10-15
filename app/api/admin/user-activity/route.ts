import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { isAdminRequest, unauthorizedResponse } from "@/lib/admin/session"
import { errorResponse } from "@/lib/futures/http"
import { isTestModeEnabled } from "@/lib/futures/demo-session"
import { ACTIVITY_KINDS, getUserActivity } from "@/lib/admin/user-activity"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const query = z.object({
  userId: z.string().uuid(),
  before: z.string().datetime({ offset: true }).nullish(),
  kinds: z
    .string()
    .nullish()
    .transform((v) => (v ? v.split(",").filter((k): k is (typeof ACTIVITY_KINDS)[number] => (ACTIVITY_KINDS as readonly string[]).includes(k)) : [])),
  limit: z.coerce.number().int().min(10).max(200).optional(),
})

export async function GET(request: NextRequest) {
  if (!(await isAdminRequest())) return unauthorizedResponse()
  const sp = request.nextUrl.searchParams
  const parsed = query.safeParse({
    userId: sp.get("userId"),
    before: sp.get("before"),
    kinds: sp.get("kinds"),
    limit: sp.get("limit") ?? undefined,
  })
  if (!parsed.success) return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 })
  if (isTestModeEnabled()) return NextResponse.json({ data: { events: [], nextCursor: null } })
  try {
    const { userId, ...opts } = parsed.data
    return NextResponse.json({ data: await getUserActivity(userId, opts) })
  } catch (e) {
    return errorResponse(e)
  }
}
