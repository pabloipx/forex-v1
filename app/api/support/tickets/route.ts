import { NextResponse } from "next/server"
import { createAdminClient, createClient } from "@/lib/supabase/server"
import { SUPPORT_MAX_OPEN_TICKETS, isSupportCategory, parseMessageBody } from "@/lib/support/constants"

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  const { data, error } = await supabase
    .from("support_tickets")
    .select("id, category, subject, status, unread_admin, unread_user, last_message_at, created_at")
    .eq("user_id", user.id)
    .order("last_message_at", { ascending: false })
    .limit(50)

  if (error) return NextResponse.json({ error: "Falha ao carregar atendimentos" }, { status: 500 })
  return NextResponse.json({ tickets: data ?? [] })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  const payload = await request.json().catch(() => null)
  const category = payload?.category
  const body = parseMessageBody(payload?.message)
  if (!isSupportCategory(category) || !body) {
    return NextResponse.json({ error: "Escolha um tipo de problema e descreva o que aconteceu." }, { status: 400 })
  }

  const admin = createAdminClient()

  const { count } = await admin
    .from("support_tickets")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .neq("status", "closed")
  if ((count ?? 0) >= SUPPORT_MAX_OPEN_TICKETS) {
    return NextResponse.json(
      { error: "Você já tem muitos atendimentos em aberto. Continue por um deles." },
      { status: 429 },
    )
  }

  const subject = body.length > 80 ? `${body.slice(0, 77)}...` : body
  const { data: ticket, error } = await admin
    .from("support_tickets")
    .insert({ user_id: user.id, category, subject })
    .select("id")
    .single()
  if (error || !ticket) return NextResponse.json({ error: "Falha ao abrir atendimento" }, { status: 500 })

  const { error: msgError } = await admin
    .from("support_messages")
    .insert({ ticket_id: ticket.id, sender: "user", body })
  if (msgError) {
    await admin.from("support_tickets").delete().eq("id", ticket.id)
    return NextResponse.json({ error: "Falha ao enviar mensagem" }, { status: 500 })
  }

  return NextResponse.json({ id: ticket.id }, { status: 201 })
}
