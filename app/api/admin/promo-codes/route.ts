import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isAdminRequest } from "@/lib/admin/session"

// Mesmo esquema de autenticacao das outras rotas de admin do projeto.

async function verifyAdminToken(): Promise<boolean> {
  return isAdminRequest()
}

/** Converte para numero aceitando vazio/nulo como null (campos opcionais da campanha). */
function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null
  const n = Number(value)
  return isNaN(n) ? null : n
}

/** GET: lista as campanhas com um resumo de quanto cada uma ja custou em bonus. */
export async function GET(request: Request) {
  try {
    if (!(await verifyAdminToken())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const adminClient = createAdminClient()

    const { data: codes, error } = await adminClient
      .from("promo_codes")
      .select("*")
      .order("created_at", { ascending: false })

    if (error) throw error

    // Soma o bonus concedido por campanha para o admin ver o custo real de cada uma.
    const { data: bonuses } = await adminClient.from("user_bonuses").select("promo_code_id, bonus_amount, status")

    const totals = new Map<string, { granted: number; active: number }>()
    for (const b of bonuses || []) {
      if (!b.promo_code_id) continue
      const entry = totals.get(b.promo_code_id) || { granted: 0, active: 0 }
      entry.granted += Number(b.bonus_amount || 0)
      if (b.status === "active") entry.active += 1
      totals.set(b.promo_code_id, entry)
    }

    return NextResponse.json({
      codes: (codes || []).map((c) => ({
        ...c,
        total_bonus_granted: Math.round((totals.get(c.id)?.granted || 0) * 100) / 100,
        active_bonuses: totals.get(c.id)?.active || 0,
      })),
    })
  } catch (error) {
    console.error("[v0] Erro ao listar codigos promocionais:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** POST: cria uma campanha. */
export async function POST(request: Request) {
  try {
    if (!(await verifyAdminToken())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const code = String(body.code || "").trim().toUpperCase()

    if (!code) {
      return NextResponse.json({ error: "Informe o código." }, { status: 400 })
    }

    const bonusValue = Number(body.bonus_value)
    if (isNaN(bonusValue) || bonusValue <= 0) {
      return NextResponse.json({ error: "O valor do bônus deve ser maior que zero." }, { status: 400 })
    }

    const bonusType = body.bonus_type === "fixed" ? "fixed" : "percent"
    const adminClient = createAdminClient()

    const { data, error } = await adminClient
      .from("promo_codes")
      .insert({
        code,
        description: body.description || null,
        bonus_type: bonusType,
        bonus_value: bonusValue,
        max_bonus: toNumberOrNull(body.max_bonus),
        min_deposit: toNumberOrNull(body.min_deposit) ?? 0,
        rollover_multiplier: toNumberOrNull(body.rollover_multiplier) ?? 1,
        max_uses: toNumberOrNull(body.max_uses),
        max_uses_per_user: toNumberOrNull(body.max_uses_per_user) ?? 1,
        is_active: body.is_active !== false,
        starts_at: body.starts_at || null,
        expires_at: body.expires_at || null,
      })
      .select()
      .single()

    if (error) {
      // 23505 = unique_violation no campo `code`.
      if (error.code === "23505") {
        return NextResponse.json({ error: "Já existe um código com esse nome." }, { status: 409 })
      }
      throw error
    }

    return NextResponse.json({ success: true, code: data })
  } catch (error) {
    console.error("[v0] Erro ao criar codigo promocional:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/** PATCH: edita uma campanha. */
export async function PATCH(request: Request) {
  try {
    if (!(await verifyAdminToken())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    if (!body.id) {
      return NextResponse.json({ error: "id é obrigatório." }, { status: 400 })
    }

    const updates: Record<string, unknown> = {}

    if (body.code !== undefined) updates.code = String(body.code).trim().toUpperCase()
    if (body.description !== undefined) updates.description = body.description || null
    if (body.bonus_type !== undefined) updates.bonus_type = body.bonus_type === "fixed" ? "fixed" : "percent"
    if (body.bonus_value !== undefined) updates.bonus_value = Number(body.bonus_value)
    if (body.max_bonus !== undefined) updates.max_bonus = toNumberOrNull(body.max_bonus)
    if (body.min_deposit !== undefined) updates.min_deposit = toNumberOrNull(body.min_deposit) ?? 0
    if (body.rollover_multiplier !== undefined) {
      updates.rollover_multiplier = toNumberOrNull(body.rollover_multiplier) ?? 1
    }
    if (body.max_uses !== undefined) updates.max_uses = toNumberOrNull(body.max_uses)
    if (body.max_uses_per_user !== undefined) {
      updates.max_uses_per_user = toNumberOrNull(body.max_uses_per_user) ?? 1
    }
    if (body.is_active !== undefined) updates.is_active = !!body.is_active
    if (body.starts_at !== undefined) updates.starts_at = body.starts_at || null
    if (body.expires_at !== undefined) updates.expires_at = body.expires_at || null

    const adminClient = createAdminClient()
    const { error } = await adminClient.from("promo_codes").update(updates).eq("id", body.id)

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "Já existe um código com esse nome." }, { status: 409 })
      }
      throw error
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Erro ao atualizar codigo promocional:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

/**
 * DELETE: remove uma campanha.
 *
 * Bloqueia a exclusao se houver bonus ativo dela: apagar deixaria usuarios com rollover em
 * andamento sem referencia da campanha. Nesse caso o admin deve desativar em vez de excluir.
 */
export async function DELETE(request: Request) {
  try {
    if (!(await verifyAdminToken())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")

    if (!id) {
      return NextResponse.json({ error: "id é obrigatório." }, { status: 400 })
    }

    const adminClient = createAdminClient()

    const { count } = await adminClient
      .from("user_bonuses")
      .select("id", { count: "exact", head: true })
      .eq("promo_code_id", id)
      .eq("status", "active")

    if ((count || 0) > 0) {
      return NextResponse.json(
        { error: "Existem bônus ativos deste código. Desative-o em vez de excluir." },
        { status: 409 },
      )
    }

    const { error } = await adminClient.from("promo_codes").delete().eq("id", id)
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("[v0] Erro ao excluir codigo promocional:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
