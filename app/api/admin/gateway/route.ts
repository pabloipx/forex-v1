import { NextResponse } from "next/server"
import { isAdminRequest } from "@/lib/admin/session"
import { pingSuitpay } from "@/lib/suitpay"

export const dynamic = "force-dynamic"

export async function GET() {
  if (!(await isAdminRequest())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  const health = await pingSuitpay()
  return NextResponse.json({ health, serverTime: new Date().toISOString() })
}
