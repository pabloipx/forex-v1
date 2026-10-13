import { cookies } from "next/headers"
import { ADMIN_COOKIE, adminCookieOptions } from "@/lib/admin/session"

export const runtime = "nodejs"

export async function POST() {
  const store = await cookies()
  store.set(ADMIN_COOKIE, "", adminCookieOptions(0))
  return Response.json({ success: true })
}
