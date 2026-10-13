import { type NextRequest, NextResponse } from "next/server"
import { isAdminRequest } from "@/lib/admin/session"
import { createAdminClient } from "@/lib/supabase/server"

// O client é criado dentro de cada handler (nunca no escopo do módulo):
// na fase de build o Next.js avalia o módulo e a criação falharia sem a URL.
function getSupabaseAdmin() {
  return createAdminClient()
}

export async function GET(request: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin()

  try {
    if (!(await isAdminRequest())) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")

    if (!userId) {
      return NextResponse.json({ error: "userId obrigatório" }, { status: 400 })
    }

    const { data: trades, error } = await supabaseAdmin
      .from("trades")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Buscar saldo atual do usuário
    const { data: balance } = await supabaseAdmin
      .from("user_balances")
      .select("balance_real, balance_demo")
      .eq("user_id", userId)
      .single()

    return NextResponse.json({
      trades: trades || [],
      balance: balance || { balance_real: 0, balance_demo: 0 },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin()
  
  try {
    if (!(await isAdminRequest())) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const body = await request.json()
    const { tradeId, userId, newResult, newAmount, newDirection, newTimeframe, newCreatedAt, adminEmail } = body

    if (!tradeId || !userId) {
      return NextResponse.json({ error: "tradeId e userId obrigatórios" }, { status: 400 })
    }

    // Buscar trade original
    const { data: originalTrade, error: fetchError } = await supabaseAdmin
      .from("trades")
      .select("*")
      .eq("id", tradeId)
      .single()

    if (fetchError || !originalTrade) {
      return NextResponse.json({ error: "Trade não encontrado" }, { status: 404 })
    }

    // Buscar saldo atual do usuário
    const { data: currentBalance, error: balanceError } = await supabaseAdmin
      .from("user_balances")
      .select("balance_real, balance_demo")
      .eq("user_id", userId)
      .single()

    if (balanceError) {
      return NextResponse.json({ error: "Saldo não encontrado" }, { status: 404 })
    }

    const isDemo = originalTrade.is_demo
    const balanceField = isDemo ? "balance_demo" : "balance_real"
    const currentBalanceValue = isDemo ? currentBalance.balance_demo : currentBalance.balance_real

    const amount = Number(newAmount) || Number(originalTrade.amount) || 0

    const rawPayout = Number(originalTrade.payout_percentage)
    // Se payout <= 1, está em formato decimal (0.95), converter para percentual (95)
    // Se payout > 1, já está em formato percentual (95)
    const payoutMultiplier = rawPayout <= 1 ? rawPayout : rawPayout / 100
    // Usar 0.95 (95%) como padrão se não definido
    const finalPayoutMultiplier = payoutMultiplier > 0 ? payoutMultiplier : 0.95

    const oldResult = originalTrade.result
    const oldAmount = Number(originalTrade.amount) || 0
    const oldProfit = Number(originalTrade.profit) || 0

    let newProfit = 0
    if (newResult === "win") {
      // Ex: R$ 10 com 0.95 (95%) = R$ 9.50 de lucro
      newProfit = Math.round(amount * finalPayoutMultiplier * 100) / 100
    } else if (newResult === "loss") {
      // Loss: prejuízo = -valor apostado
      newProfit = -amount
    } else {
      // Pending: sem lucro/prejuízo
      newProfit = 0
    }

    let balanceAdjustment = 0

    // Primeiro reverter o resultado anterior
    if (oldResult === "win") {
      // Se era win, usuário tinha: valor original + lucro antigo
      // Precisamos remover isso
      balanceAdjustment -= oldAmount + Math.abs(oldProfit)
    } else if (oldResult === "loss") {
      // Se era loss, usuário já tinha perdido o valor
      // Precisamos devolver para poder recalcular
      balanceAdjustment += oldAmount
    }
    // Se era pending, o valor já foi debitado na abertura, não precisa reverter

    // Agora aplicar o novo resultado
    if (newResult === "win") {
      // Win: creditar valor apostado + lucro calculado
      balanceAdjustment += amount + newProfit
    } else if (newResult === "loss") {
      // Loss: se mudou de pending/win para loss
      if (oldResult === "pending") {
        // Se era pending, o valor já foi debitado na abertura
        // Não precisa debitar novamente
      } else if (oldResult === "win") {
        // Se era win e agora é loss, precisa debitar o valor
        balanceAdjustment -= amount
      }
    } else if (newResult === "pending") {
      // Voltando para pending - devolver valor se necessário
      if (oldResult === "loss") {
        // Era loss, agora pending - valor já foi devolvido acima
      }
    }

    const newBalanceValue = Math.max(0, Math.round((currentBalanceValue + balanceAdjustment) * 100) / 100)

    // Registrar auditoria antes de fazer alterações
    const { error: auditError } = await supabaseAdmin.from("trade_history_log").insert({
      trade_id: tradeId,
      user_id: userId,
      admin_id: adminEmail || "admin",
      old_status: originalTrade.result,
      new_status: newResult || originalTrade.result,
      old_value: oldAmount,
      new_value: amount,
      old_profit: oldProfit,
      new_profit: newProfit,
      old_direction: originalTrade.direction,
      new_direction: newDirection || originalTrade.direction,
      old_timeframe: originalTrade.timeframe,
      new_timeframe: newTimeframe || originalTrade.timeframe,
      old_created_at: originalTrade.created_at,
      new_created_at: newCreatedAt || originalTrade.created_at,
      balance_before: currentBalanceValue,
      balance_after: newBalanceValue,
      balance_adjustment: balanceAdjustment,
      changed_at: new Date().toISOString(),
    })

    if (auditError) {
      console.error("Erro ao registrar auditoria:", auditError)
    }

    const { error: updateTradeError } = await supabaseAdmin
      .from("trades")
      .update({
        result: newResult || originalTrade.result,
        amount: amount,
        direction: newDirection || originalTrade.direction,
        timeframe: newTimeframe || originalTrade.timeframe,
        created_at: newCreatedAt || originalTrade.created_at,
        profit: newProfit,
        payout_percentage: finalPayoutMultiplier,
        is_manually_adjusted: true,
        adjusted_by: adminEmail || "admin",
        adjusted_at: new Date().toISOString(),
      })
      .eq("id", tradeId)

    if (updateTradeError) {
      return NextResponse.json({ error: updateTradeError.message }, { status: 500 })
    }

    // Atualizar saldo do usuário
    const { error: updateBalanceError } = await supabaseAdmin
      .from("user_balances")
      .update({ [balanceField]: newBalanceValue })
      .eq("user_id", userId)

    if (updateBalanceError) {
      return NextResponse.json({ error: updateBalanceError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: "Operação atualizada com sucesso",
      balanceAdjustment,
      newBalance: newBalanceValue,
      oldProfit,
      newProfit,
      payoutUsed: finalPayoutMultiplier,
      amountUsed: amount,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin()
  
  try {
    if (!(await isAdminRequest())) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get("userId")

    if (!userId) {
      return NextResponse.json({ error: "userId obrigatório" }, { status: 400 })
    }

    // Deletar todos os trades do usuário
    const { error: deleteError, count } = await supabaseAdmin.from("trades").delete().eq("user_id", userId)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: `Histórico limpo com sucesso`,
      deletedCount: count,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
