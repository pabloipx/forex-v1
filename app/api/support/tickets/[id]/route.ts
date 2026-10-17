import { NextResponse } from "next/server"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import { parseMessageBody } from "@/lib/support/constants"

type Context = { params: Promise<{ id: string }> }

async function loadOwnTicket(id: string) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: "Não autenticado" }, { status: 401 }) }

  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("id, category, subject, status, unread_admin, unread_user, last_message_at, created_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle()
  if (!ticket) return { error: NextResponse.json({ error: "Atendimento não encontrado" }, { status: 404 }) }

  return { supabase, ticket }
}

export async function GET(_request: Request, { params }: Context) {
  const { id } = await params
  const result = await loadOwnTicket(id)
  if ("error" in result) return result.error
  const { supabase, ticket } = result

  const { data: messages } = await supabase
    .from("support_messages")
    .select("id, ticket_id, sender, body, created_at")
    .eq("ticket_id", id)
    .order("created_at", { ascending: true })

  if (ticket.unread_user) {
    await createAdminClient().from("support_tickets").update({ unread_user: false }).eq("id", id)
  }

  return NextResponse.json({ ticket: { ...ticket, unread_user: false }, messages: messages ?? [] })
}

export async function POST(request: Request, { params }: Context) {
  const { id } = await params
  const result = await loadOwnTicket(id)
  if ("error" in result) return result.error
  if (result.ticket.status === "closed") {
    return NextResponse.json({ error: "Este atendimento foi encerrado." }, { status: 409 })
  }

  const payload = await request.json().catch(() => null)
  const body = parseMessageBody(payload?.message)
  if (!body) return NextResponse.json({ error: "Mensagem inválida" }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin.from("support_messages").insert({ ticket_id: id, sender: "user", body })
  if (error) return NextResponse.json({ error: "Falha ao enviar mensagem" }, { status: 500 })

  await admin
    .from("support_tickets")
    .update({ status: "open", unread_admin: true, last_message_at: new Date().toISOString() })
    .eq("id", id)

  return NextResponse.json({ ok: true }, { status: 201 })
}
