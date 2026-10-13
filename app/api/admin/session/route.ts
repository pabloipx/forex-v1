import { isAdminRequest } from "@/lib/admin/session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  return Response.json({ authenticated: await isAdminRequest() })
}
