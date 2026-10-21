import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isAdminRequest } from "@/lib/admin/session"

export async function GET(request: Request) {
  try {
    if (!(await isAdminRequest())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const adminClient = createAdminClient()

    const { searchParams } = new URL(request.url)
    const limit = Math.min(Math.max(Number.parseInt(searchParams.get("limit") || "50") || 50, 1), 200)
    const offset = Math.max(Number.parseInt(searchParams.get("offset") || "0") || 0, 0)

    const { data: trades, error } = await adminClient
      .from("trades")
      .select("*, profiles(email)")
      .order("entry_time", { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) throw error

    return NextResponse.json({ trades: trades || [] })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
