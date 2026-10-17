import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { isAdminRequest, unauthorizedResponse } from "@/lib/admin/session"

export async function GET(request: Request) {
  if (!(await isAdminRequest())) return unauthorizedResponse()

  const status = new URL(request.url).searchParams.get("status")
  const admin = createAdminClient()

  let query = admin
    .from("support_tickets")
    .select("id, user_id, category, subject, status, unread_admin, unread_user, last_message_at, created_at")
    .order("last_message_at", { ascending: false })
    .limit(200)
  if (status === "open" || status === "answered" || status === "closed") query = query.eq("status", status)

  const { data: tickets, error } = await query
  if (error) return NextResponse.json({ error: "Falha ao carregar tickets" }, { status: 500 })

  const userIds = [...new Set((tickets ?? []).map((t) => t.user_id))]
  const { data: profiles } = userIds.length
    ? await admin.from("profiles").select("id, email, full_name").in("id", userIds)
    : { data: [] }
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]))

  const { data: counts } = await admin
    .from("support_tickets")
    .select("status, unread_admin")
  const summary = { open: 0, answered: 0, closed: 0, unread: 0 }
  for (const row of counts ?? []) {
    summary[row.status as "open" | "answered" | "closed"]++
    if (row.unread_admin) summary.unread++
  }

  return NextResponse.json({
    summary,
    tickets: (tickets ?? []).map((t) => ({
      ...t,
      user_name: byId.get(t.user_id)?.full_name || "",
      user_email: byId.get(t.user_id)?.email || "",
    })),
  })
}
