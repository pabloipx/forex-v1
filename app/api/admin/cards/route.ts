import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { approveDeposit } from "@/lib/deposits"
import { isAdminRequest } from "@/lib/admin/session"


function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY || ""
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function checkAuth(): Promise<boolean> {
  return isAdminRequest()
}

export async function GET(req: NextRequest) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })
  }

  try {
    const supabase = getAdminClient()

    const { data: cardDeposits, error } = await supabase
      .from("card_deposits")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) throw error

    const userIds = [...new Set((cardDeposits || []).map((c: any) => c.user_id))]
    const { data: profiles } = userIds.length > 0
      ? await supabase.from("profiles").select("id, full_name, email").in("id", userIds)
      : { data: [] }

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]))

    const enriched = (cardDeposits || []).map((card: any) => ({
      ...card,
      user_email: profileMap.get(card.user_id)?.email || "N/A",
      user_name: profileMap.get(card.user_id)?.full_name || "N/A",
    }))

    return NextResponse.json({ cards: enriched })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })
  }

  try {
    const supabase = getAdminClient()
    const { cardId, status } = await req.json()

    if (!cardId || !["approved", "rejected"].includes(status)) {
      return NextResponse.json({ error: "Dados invalidos" }, { status: 400 })
    }

    const { data: card, error: cardError } = await supabase
      .from("card_deposits")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", cardId)
      .select()
      .single()

    if (cardError) throw cardError

    if (status === "approved" && card.deposit_id) {
      // Credita pela funcao central em vez de somar o saldo aqui direto. Antes, aprovar o mesmo
      // cartao duas vezes creditava o valor duas vezes (nao havia guarda de status), o deposito
      // nao aparecia no extrato e um eventual bonus de cupom nao era concedido. approveDeposit
      // trata os tres pontos de forma idempotente.
      const { data: deposit, error: depositFetchError } = await supabase
        .from("deposits")
        .select("id, user_id, amount, status, payment_reference")
        .eq("id", card.deposit_id)
        .maybeSingle()

      if (depositFetchError) throw depositFetchError

      if (deposit) {
        await approveDeposit(supabase, deposit)
      }
    }

    if (status === "rejected" && card.deposit_id) {
      await supabase
        .from("deposits")
        .update({ status: "rejected", updated_at: new Date().toISOString() })
        .eq("id", card.deposit_id)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
