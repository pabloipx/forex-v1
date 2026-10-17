import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { isAdminRequest, unauthorizedResponse } from "@/lib/admin/session"
import { parseMessageBody } from "@/lib/support/constants"

type Context = { params: Promise<{ id: string }> }

export async function GET(_request: Request, { params }: Context) {
  if (!(await isAdminRequest())) return unauthorizedResponse()
  const { id } = await params
  const admin = createAdminClient()

  const { data: ticket } = await admin
    .from("support_tickets")
    .select("id, ticket_number, user_id, category, subject, status, unread_admin, last_message_at, created_at")
    .eq("id", id)
    .maybeSingle()
  if (!ticket) return NextResponse.json({ error: "Ticket não encontrado" }, { status: 404 })

  const [{ data: messages }, { data: profile }] = await Promise.all([
    admin
      .from("support_messages")
      .select("id, ticket_id, sender, body, created_at")
      .eq("ticket_id", id)
      .order("created_at", { ascending: true }),
    admin.from("profiles").select("email, full_name, phone").eq("id", ticket.user_id).maybeSingle(),
  ])

  if (ticket.unread_admin) await admin.from("support_tickets").update({ unread_admin: false }).eq("id", id)

  return NextResponse.json({
    ticket: { ...ticket, unread_admin: false },
    user: { email: profile?.email || "", full_name: profile?.full_name || "", phone: profile?.phone || "" },
    messages: messages ?? [],
  })
}

export async function POST(request: Request, { params }: Context) {
  if (!(await isAdminRequest())) return unauthorizedResponse()
  const { id } = await params
  const payload = await request.json().catch(() => null)
  const body = parseMessageBody(payload?.message)
  if (!body) return NextResponse.json({ error: "Mensagem inválida" }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from("support_messages").insert({ ticket_id: id, sender: "admin", body })
  if (error) return NextResponse.json({ error: "Falha ao enviar resposta" }, { status: 500 })

  await admin
    .from("support_tickets")
    .update({
      status: "answered",
      unread_user: true,
      unread_admin: false,
      last_message_at: new Date().toISOString(),
    })
    .eq("id", id)

  return NextResponse.json({ ok: true }, { status: 201 })
}

export async function PATCH(request: Request, { params }: Context) {
  if (!(await isAdminRequest())) return unauthorizedResponse()
  const { id } = await params
  const payload = await request.json().catch(() => null)
  const status = payload?.status
  if (status !== "open" && status !== "closed") {
    return NextResponse.json({ error: "Status inválido" }, { status: 400 })
  }

  const { error } = await createAdminClient().from("support_tickets").update({ status }).eq("id", id)
  if (error) return NextResponse.json({ error: "Falha ao atualizar ticket" }, { status: 500 })
  return NextResponse.json({ ok: true })
}
