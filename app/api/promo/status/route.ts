import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { getActiveBonus, shouldCancelBonusOnWithdrawal } from "@/lib/promo-codes"
import { getDepositRolloverSummary, getWithdrawalProcessingHours } from "@/lib/deposit-rollover"

/**
 * Situacao do rollover do usuario logado: quanto de bonus esta travado, quanto de volume falta e
 * se o saque cancela o bonus.
 *
 * Usada pelo card de progresso na area do usuario e pelo aviso na tela de saque.
 */
export async function GET() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Nao autenticado" }, { status: 401 })
    }

    const supabaseAdmin = createAdminClient()
    const bonus = await getActiveBonus(supabaseAdmin, user.id)

    // Rollover do valor depositado e prazo de saque acompanham a resposta em qualquer caso: a tela
    // de saque precisa deles mesmo quando o usuario nao tem bonus de codigo promocional.
    const [depositRollover, withdrawalHours] = await Promise.all([
      getDepositRolloverSummary(supabaseAdmin, user.id),
      getWithdrawalProcessingHours(supabaseAdmin),
    ])

    const depositRolloverPayload = depositRollover
      ? {
          lockedAmount: depositRollover.locked,
          rolloverRequired: depositRollover.required,
          rolloverProgress: depositRollover.progress,
          remaining: depositRollover.remaining,
          progressPercent:
            depositRollover.required > 0
              ? Math.min(100, Math.round((depositRollover.progress / depositRollover.required) * 100))
              : 100,
          depositsCount: depositRollover.count,
        }
      : null

    if (!bonus) {
      return NextResponse.json({
        hasActiveBonus: false,
        depositRollover: depositRolloverPayload,
        withdrawalHours,
      })
    }

    const required = Number(bonus.rollover_required || 0)
    const progress = Number(bonus.rollover_progress || 0)

    return NextResponse.json({
      hasActiveBonus: true,
      depositRollover: depositRolloverPayload,
      withdrawalHours,
      code: bonus.code,
      bonusAmount: Number(bonus.bonus_amount),
      lockedAmount: Number(bonus.bonus_amount),
      rolloverRequired: required,
      rolloverProgress: progress,
      remaining: Math.max(0, Math.round((required - progress) * 100) / 100),
      // Rollover exigido zero significa bonus livre; evita divisao por zero.
      progressPercent: required > 0 ? Math.min(100, Math.round((progress / required) * 100)) : 100,
      cancelsOnWithdrawal: await shouldCancelBonusOnWithdrawal(supabaseAdmin),
      grantedAt: bonus.granted_at,
    })
  } catch (error) {
    console.error("[v0] Erro ao buscar status do bonus:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
