import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  const key = process.env.SUPABASE_SECRET_KEY || ""
  return createClient(url, key)
}

async function getAuthenticatedUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const supabaseAdmin = getSupabaseAdmin()

  // Verificar se e afiliado ativo (apenas afiliados podem editar suas trades)
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, is_affiliate, affiliate_code, affiliate_status, full_name, email")
    .eq("id", user.id)
    .single()

  if (!profile?.is_affiliate || !profile.affiliate_code) return null

  return { userId: user.id, profile }
}

// GET: listar minhas proprias trades
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser()
    if (!auth) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })
    }

    const supabaseAdmin = getSupabaseAdmin()
    const { searchParams } = new URL(request.url)
    const result = searchParams.get("result")

    let query = supabaseAdmin
      .from("trades")
      .select("*")
      .eq("user_id", auth.userId)
      .order("created_at", { ascending: false })
      .limit(200)

    if (result && result !== "all") {
      query = query.eq("result", result)
    }

    const { data: trades, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Estatisticas
    const allTrades = trades || []
    const stats = {
      total: allTrades.length,
      wins: allTrades.filter(t => t.result === "win").length,
      losses: allTrades.filter(t => t.result === "loss").length,
      pending: allTrades.filter(t => t.result === "pending").length,
    }

    return NextResponse.json({ trades: allTrades, stats })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT: editar resultado da minha propria trade (apenas WIN/LOSS)
export async function PUT(request: NextRequest) {
  try {
    const auth = await getAuthenticatedUser()
    if (!auth) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })
    }

    const supabaseAdmin = getSupabaseAdmin()
    const body = await request.json()
    const { tradeId, newResult } = body

    if (!tradeId || !["win", "loss"].includes(newResult)) {
      return NextResponse.json({ error: "Dados invalidos" }, { status: 400 })
    }

    // Buscar trade original (verificando que pertence ao usuario)
    const { data: originalTrade, error: fetchError } = await supabaseAdmin
      .from("trades")
      .select("*")
      .eq("id", tradeId)
      .eq("user_id", auth.userId)
      .single()

    if (fetchError || !originalTrade) {
      return NextResponse.json({ error: "Trade nao encontrado" }, { status: 404 })
    }

    // Buscar saldo atual
    const { data: currentBalance, error: balanceError } = await supabaseAdmin
      .from("user_balances")
      .select("balance_real, balance_demo")
      .eq("user_id", auth.userId)
      .single()

    if (balanceError) {
      return NextResponse.json({ error: "Saldo nao encontrado" }, { status: 404 })
    }

    const isDemo = originalTrade.is_demo
    const balanceField = isDemo ? "balance_demo" : "balance_real"
    const currentBalanceValue = isDemo ? currentBalance.balance_demo : currentBalance.balance_real
    const amount = Number(originalTrade.amount) || 0

    const rawPayout = Number(originalTrade.payout_percentage)
    const payoutMultiplier = rawPayout <= 1 ? rawPayout : rawPayout / 100
    const finalPayoutMultiplier = payoutMultiplier > 0 ? payoutMultiplier : 0.95

    const oldResult = originalTrade.result
    const oldProfit = Number(originalTrade.profit) || 0

    let newProfit = 0
    if (newResult === "win") {
      newProfit = Math.round(amount * finalPayoutMultiplier * 100) / 100
    } else {
      newProfit = -amount
    }

    let balanceAdjustment = 0

    // Reverter resultado anterior
    if (oldResult === "win") {
      balanceAdjustment -= amount + Math.abs(oldProfit)
    } else if (oldResult === "loss") {
      balanceAdjustment += amount
    }

    // Aplicar novo resultado
    if (newResult === "win") {
      balanceAdjustment += amount + newProfit
    } else if (newResult === "loss") {
      if (oldResult === "pending") {
        // valor ja debitado na abertura
      } else if (oldResult === "win") {
        balanceAdjustment -= amount
      }
    }

    const newBalanceValue = Math.max(0, Math.round((currentBalanceValue + balanceAdjustment) * 100) / 100)

    // Auditoria
    await supabaseAdmin.from("trade_history_log").insert({
      trade_id: tradeId,
      user_id: auth.userId,
      admin_id: `self:${auth.userId}`,
      old_status: originalTrade.result,
      new_status: newResult,
      old_value: amount,
      new_value: amount,
      old_profit: oldProfit,
      new_profit: newProfit,
      old_direction: originalTrade.direction,
      new_direction: originalTrade.direction,
      old_timeframe: originalTrade.timeframe,
      new_timeframe: originalTrade.timeframe,
      old_created_at: originalTrade.created_at,
      new_created_at: originalTrade.created_at,
      balance_before: currentBalanceValue,
      balance_after: newBalanceValue,
      balance_adjustment: balanceAdjustment,
      changed_at: new Date().toISOString(),
    })

    // Atualizar trade
    await supabaseAdmin
      .from("trades")
      .update({
        result: newResult,
        profit: newProfit,
        is_manually_adjusted: true,
        adjusted_by: `self:${auth.userId}`,
        adjusted_at: new Date().toISOString(),
      })
      .eq("id", tradeId)

    // Atualizar saldo
    await supabaseAdmin
      .from("user_balances")
      .update({ [balanceField]: newBalanceValue })
      .eq("user_id", auth.userId)

    return NextResponse.json({
      success: true,
      newBalance: newBalanceValue,
      balanceAdjustment,
      newProfit,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
