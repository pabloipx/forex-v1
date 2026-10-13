import { createClient } from "@supabase/supabase-js"
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  const key = process.env.SUPABASE_SECRET_KEY || ""
  return createClient(url, key)
}

async function getAuthenticatedAffiliate() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const supabaseAdmin = getSupabaseAdmin()

  // Verificar se e afiliado ativo
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, is_affiliate, affiliate_code, affiliate_status")
    .eq("id", user.id)
    .single()

  if (!profile?.is_affiliate || !profile.affiliate_code) return null

  return { userId: user.id, affiliateCode: profile.affiliate_code }
}

// GET: listar indicados e seus trades
export async function GET(request: NextRequest) {
  try {
    const affiliate = await getAuthenticatedAffiliate()
    if (!affiliate) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })
    }

    const supabaseAdmin = getSupabaseAdmin()
    const { searchParams } = new URL(request.url)
    const referredUserId = searchParams.get("userId")

    // Se tem userId, retornar trades desse indicado
    if (referredUserId) {
      // Verificar que esse usuario e de fato indicado deste afiliado
      const { data: referredProfile } = await supabaseAdmin
        .from("profiles")
        .select("id, referred_by")
        .eq("id", referredUserId)
        .single()

      if (!referredProfile || referredProfile.referred_by !== affiliate.affiliateCode) {
        return NextResponse.json({ error: "Usuario nao e seu indicado" }, { status: 403 })
      }

      // Buscar trades do indicado
      const { data: trades, error } = await supabaseAdmin
        .from("trades")
        .select("*")
        .eq("user_id", referredUserId)
        .order("created_at", { ascending: false })
        .limit(100)

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }

      // Buscar saldo
      const { data: balance } = await supabaseAdmin
        .from("user_balances")
        .select("balance_real, balance_demo")
        .eq("user_id", referredUserId)
        .single()

      return NextResponse.json({
        trades: trades || [],
        balance: balance || { balance_real: 0, balance_demo: 0 },
      })
    }

    // Sem userId: listar todos os indicados e suas trades recentes
    const { data: referredUsers, error } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, created_at")
      .eq("referred_by", affiliate.affiliateCode)
      .order("created_at", { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const referrals = (referredUsers || []).map(u => ({
      id: u.id,
      email: u.email || "",
      full_name: u.full_name || "Sem nome",
    }))

    // Se all=true, buscar trades recentes de TODOS os indicados
    const allMode = searchParams.get("all") === "true"
    if (allMode && referrals.length > 0) {
      const userIds = referrals.map(r => r.id)
      const { data: allTrades } = await supabaseAdmin
        .from("trades")
        .select("*")
        .in("user_id", userIds)
        .order("created_at", { ascending: false })
        .limit(200)

      // Enriquecer trades com nome/email do indicado
      const userMap = Object.fromEntries(referrals.map(r => [r.id, r]))
      const enrichedTrades = (allTrades || []).map(t => ({
        ...t,
        user_name: userMap[t.user_id]?.full_name || "Sem nome",
        user_email: userMap[t.user_id]?.email || "",
      }))

      return NextResponse.json({ referrals, trades: enrichedTrades })
    }

    return NextResponse.json({ referrals })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// PUT: editar resultado de trade de um indicado (apenas WIN/LOSS)
export async function PUT(request: NextRequest) {
  try {
    const affiliate = await getAuthenticatedAffiliate()
    if (!affiliate) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })
    }

    const supabaseAdmin = getSupabaseAdmin()
    const body = await request.json()
    const { tradeId, userId, newResult } = body

    if (!tradeId || !userId || !["win", "loss"].includes(newResult)) {
      return NextResponse.json({ error: "Dados invalidos" }, { status: 400 })
    }

    // Verificar que o usuario e indicado deste afiliado
    const { data: referredProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, referred_by")
      .eq("id", userId)
      .single()

    if (!referredProfile || referredProfile.referred_by !== affiliate.affiliateCode) {
      return NextResponse.json({ error: "Usuario nao e seu indicado" }, { status: 403 })
    }

    // Buscar trade original
    const { data: originalTrade, error: fetchError } = await supabaseAdmin
      .from("trades")
      .select("*")
      .eq("id", tradeId)
      .eq("user_id", userId)
      .single()

    if (fetchError || !originalTrade) {
      return NextResponse.json({ error: "Trade nao encontrado" }, { status: 404 })
    }

    // Buscar saldo atual
    const { data: currentBalance, error: balanceError } = await supabaseAdmin
      .from("user_balances")
      .select("balance_real, balance_demo")
      .eq("user_id", userId)
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
    const oldAmount = Number(originalTrade.amount) || 0
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
      balanceAdjustment -= oldAmount + Math.abs(oldProfit)
    } else if (oldResult === "loss") {
      balanceAdjustment += oldAmount
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
      user_id: userId,
      admin_id: `affiliate:${affiliate.userId}`,
      old_status: originalTrade.result,
      new_status: newResult,
      old_value: oldAmount,
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
        adjusted_by: `affiliate:${affiliate.userId}`,
        adjusted_at: new Date().toISOString(),
      })
      .eq("id", tradeId)

    // Atualizar saldo
    await supabaseAdmin
      .from("user_balances")
      .update({ [balanceField]: newBalanceValue })
      .eq("user_id", userId)

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
