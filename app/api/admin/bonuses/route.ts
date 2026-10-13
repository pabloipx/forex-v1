import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { cancelActiveBonus } from "@/lib/promo-codes"
import { isAdminRequest } from "@/lib/admin/session"


async function verifyAdminToken(): Promise<boolean> {
  return isAdminRequest()
}

/**
 * GET: lista os bonus concedidos com o progresso do rollover.
 *
 * Aceita ?status=active|completed|cancelled para filtrar.
 */
export async function GET(request: Request) {
  try {
    if (!(await verifyAdminToken())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")

    const adminClient = createAdminClient()

    let query = adminClient
      .from("user_bonuses")
      .select("*")
      .order("granted_at", { ascending: false })
      .limit(200)

    if (status && ["active", "completed", "cancelled"].includes(status)) {
      query = query.eq("status", status)
    }

    const { data: bonuses, error } = await query
    if (error) throw error

    // Busca os dados dos usuarios em uma consulta so, em vez de uma por bonus.
    const userIds = [...new Set((bonuses || []).map((b) => b.user_id))]
    const { data: profiles } = userIds.length
      ? await adminClient.from("profiles").select("id, full_name, email").in("id", userIds)
      : { data: [] }

    const profileMap = new Map((profiles || []).map((p) => [p.id, p]))

    const enriched = (bonuses || []).map((b) => {
      const required = Number(b.rollover_required || 0)
      const progress = Number(b.rollover_progress || 0)
      const profile = profileMap.get(b.user_id)

      return {
        ...b,
        user_name: profile?.full_name || "—",
        user_email: profile?.email || "—",
        // Quando o rollover exigido e zero, o bonus e livre: tratamos como 100% cumprido.
        progress_percent: required > 0 ? Math.min(100, Math.round((progress / required) * 100)) : 100,
        remaining: Math.max(0, Math.round((required - progress) * 100) / 100),
      }
    })

    const totals = {
      active: enriched.filter((b) => b.status === "active").length,
      total_granted:
        Math.round((bonuses || []).reduce((sum, b) => sum + Number(b.bonus_amount || 0), 0) * 100) / 100,
      locked:
        Math.round(
          (bonuses || [])
            .filter((b) => b.status === "active")
            .reduce((sum, b) => sum + Number(b.bonus_amount || 0), 0) * 100,
        ) / 100,
    }

    return NextResponse.json({ bonuses: enriched, totals })
  } catch (error) {
    console.error("[v0] Erro ao listar bonus:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * POST: acoes do admin sobre um bonus.
 *
 * - action "complete": libera o bonus manualmente (perdoa o rollover restante).
 * - action "cancel": cancela e remove do saldo o valor travado.
 * - action "recalc": forca o recalculo do volume negociado.
 */
export async function POST(request: Request) {
  try {
    if (!(await verifyAdminToken())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { bonusId, action } = body

    if (!bonusId || !action) {
      return NextResponse.json({ error: "bonusId e action são obrigatórios." }, { status: 400 })
    }

    const adminClient = createAdminClient()

    const { data: bonus } = await adminClient
      .from("user_bonuses")
      .select("id, user_id, status")
      .eq("id", bonusId)
      .maybeSingle()

    if (!bonus) {
      return NextResponse.json({ error: "Bônus não encontrado." }, { status: 404 })
    }

    if (action === "complete") {
      if (bonus.status !== "active") {
        return NextResponse.json({ error: "Este bônus não está ativo." }, { status: 409 })
      }

      const { error } = await adminClient
        .from("user_bonuses")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", bonusId)
        .eq("status", "active")

      if (error) throw error
      return NextResponse.json({ success: true, message: "Bônus liberado." })
    }

    if (action === "cancel") {
      if (bonus.status !== "active") {
        return NextResponse.json({ error: "Este bônus não está ativo." }, { status: 409 })
      }

      const result = await cancelActiveBonus(adminClient, bonus.user_id, "cancelado pelo administrador")

      if (!result.cancelled) {
        return NextResponse.json({ error: "Não foi possível cancelar o bônus." }, { status: 409 })
      }

      return NextResponse.json({
        success: true,
        message: `Bônus cancelado. R$ ${(result.removedAmount || 0).toFixed(2)} removidos do saldo.`,
      })
    }

    if (action === "recalc") {
      // Chama a mesma funcao do banco usada pelo trigger, para o admin conferir o valor.
      const { error } = await adminClient.rpc("recalc_user_rollover", { p_user_id: bonus.user_id })
      if (error) throw error
      return NextResponse.json({ success: true, message: "Progresso recalculado." })
    }

    return NextResponse.json({ error: "Ação inválida." }, { status: 400 })
  } catch (error) {
    console.error("[v0] Erro na acao sobre bonus:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
