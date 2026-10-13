import { createClient, createAdminClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { getAffiliateSettings, resolveTerms, round2 } from "@/lib/affiliate-commission"
import { accrueTradeRevshare } from "@/lib/affiliate-revshare"

// GET - Obter dados do afiliado
export async function GET() {
  try {
    console.log("[v0] Affiliate GET - Starting")
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    console.log("[v0] Affiliate GET - User:", user?.id)

    if (!user) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })
    }

    const admin = createAdminClient()

    // Buscar dados do perfil do usuario via admin (bypass RLS)
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle()

    if (profileError) {
      console.log("[v0] Affiliate GET - Profile error:", profileError)
      return NextResponse.json({ error: "Erro ao buscar perfil" }, { status: 500 })
    }
    
    console.log("[v0] Affiliate GET - Profile:", profile)

    // If profile doesn't exist yet, create it
    if (!profile) {
      const { error: insertError } = await admin
        .from("profiles")
        .insert({
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Usuario",
        })

      if (insertError) {
        return NextResponse.json({ error: "Erro ao criar perfil" }, { status: 500 })
      }

      return NextResponse.json({ affiliate: null })
    }

    if (!profile.is_affiliate) {
      return NextResponse.json({ affiliate: null })
    }

    const settings = await getAffiliateSettings(admin)

    // Reapura o RevShare das operacoes antes de montar a resposta, para o painel refletir as
    // operacoes encerradas desde a ultima visita. A funcao e idempotente e nunca lanca excecao.
    await accrueTradeRevshare(admin, profile, settings)

    // Relê o perfil: a apuracao acima pode ter ajustado saldo e total ganho.
    const { data: refreshedProfile } = await admin
      .from("profiles")
      .select("affiliate_balance, affiliate_total_earned")
      .eq("id", user.id)
      .maybeSingle()

    const balance = refreshedProfile?.affiliate_balance ?? profile.affiliate_balance ?? 0
    const totalEarnedStored = refreshedProfile?.affiliate_total_earned ?? profile.affiliate_total_earned ?? 0

    // Buscar referidos via admin (cross-user query)
    const { data: referredUsers } = await admin
      .from("profiles")
      .select("id, full_name, email, created_at, referred_subid")
      .eq("referred_by", profile.affiliate_code)
      .order("created_at", { ascending: false })

    const terms = resolveTerms(profile, settings)

    // Comissoes efetivamente registradas, que sao a fonte da verdade.
    //
    // Antes esta rota recalculava a comissao a partir dos depositos a cada leitura. Isso passou a
    // divergir do que o afiliado realmente recebeu, porque o RevShare agora nasce das operacoes e
    // nao do valor depositado — recalcular pelos depositos mostraria RevShare zero.
    const { data: commissionRows } = await admin
      .from("affiliate_commissions")
      .select("referred_user_id, amount, revshare_amount, cpa_amount")
      .eq("affiliate_id", user.id)

    const commissionByReferral = new Map<string, { total: number; revshare: number; cpa: number }>()
    for (const row of commissionRows ?? []) {
      const acc = commissionByReferral.get(row.referred_user_id) ?? { total: 0, revshare: 0, cpa: 0 }
      acc.total += Number(row.amount || 0)
      acc.revshare += Number(row.revshare_amount || 0)
      acc.cpa += Number(row.cpa_amount || 0)
      commissionByReferral.set(row.referred_user_id, acc)
    }

    // Para cada referido, buscar depositos aprovados e aplicar o modelo de comissao vigente
    const referralsWithDeposits = await Promise.all(
      (referredUsers || []).map(async (referredUser) => {
        const { data: deposits } = await admin
          .from("deposits")
          .select("amount, created_at")
          .eq("user_id", referredUser.id)
          .in("status", ["approved", "completed"])
          .order("created_at", { ascending: true })

        const rows = deposits || []
        const totalDeposits = rows.reduce((sum, d) => sum + Number(d.amount), 0)

        const earned = commissionByReferral.get(referredUser.id) ?? { total: 0, revshare: 0, cpa: 0 }
        const commission = earned.total
        const revshareTotal = earned.revshare
        const cpaTotal = earned.cpa

        return {
          id: referredUser.id,
          referred_user_id: referredUser.id,
          status: totalDeposits > 0 ? "active" : "registered",
          total_deposits: totalDeposits,
          total_commission: round2(commission),
          revshare_commission: round2(revshareTotal),
          cpa_commission: round2(cpaTotal),
          created_at: referredUser.created_at,
          subid: referredUser.referred_subid ?? null,
          profiles: {
            full_name: referredUser.full_name,
            email: referredUser.email,
          },
        }
      })
    )

    const totalReferrals = referralsWithDeposits.length
    const referralsWithDeposit = referralsWithDeposits.filter((r) => r.total_deposits > 0).length
    const totalEarned = referralsWithDeposits.reduce((sum, r) => sum + r.total_commission, 0)

    // Buscar historico de saques
    const { data: withdrawals } = await admin
      .from("affiliate_withdrawals")
      .select("*")
      .eq("affiliate_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20)

    return NextResponse.json({
      affiliate: {
        id: user.id,
        user_id: user.id,
        code: profile.affiliate_code,
        commission_rate: terms.revsharePercent,
        commission_model: terms.model,
        cpa_amount: terms.cpaAmount,
        cpa_min_deposit: terms.cpaMinDeposit,
        sub_percent: terms.subPercent,
        min_withdrawal: settings.min_withdrawal,
        withdrawal_fee_percent: settings.withdrawal_fee_percent,
        balance,
        status: profile.affiliate_status || "active",
        total_earned: totalEarnedStored || totalEarned,
        total_referrals: totalReferrals,
        referrals_with_deposit: referralsWithDeposit,
      },
      referrals: referralsWithDeposits,
      withdrawals: withdrawals || [],
      // Preferencias de exibicao controladas pelo admin
      display: {
        currency: settings.display_currency,
        usd_rate: settings.usd_rate,
        next_payment_date: settings.next_payment_date,
      },
    })
  } catch (error) {
    console.log("[v0] Affiliate GET - Error:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}


// POST - Tornar-se afiliado
export async function POST() {
  try {
    console.log("[v0] Affiliate POST - Starting")
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    console.log("[v0] Affiliate POST - User:", user?.id)

    if (!user) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })
    }

    const admin = createAdminClient()

    // Verificar se ja e afiliado (via admin to bypass RLS)
    const { data: profile } = await admin
      .from("profiles")
      .select("is_affiliate, affiliate_code, affiliate_commission_percent, affiliate_balance, affiliate_status")
      .eq("id", user.id)
      .maybeSingle()

    if (profile?.is_affiliate && profile?.affiliate_code) {
      return NextResponse.json({
        affiliate: {
          id: user.id,
          user_id: user.id,
          code: profile.affiliate_code,
          commission_rate: profile.affiliate_commission_percent || 77,
          balance: profile.affiliate_balance || 0,
          status: profile.affiliate_status || "active",
          total_earned: 0,
          total_referrals: 0,
          referrals_with_deposit: 0,
        },
      })
    }

    // If profile doesn't exist, create it first
    if (!profile) {
      const { error: insertError } = await admin.from("profiles").insert({
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Usuario",
      })
      if (insertError) {
        return NextResponse.json({ error: "Erro ao criar perfil" }, { status: 500 })
      }
    }

    // Gerar codigo unico
    const generateCode = () => {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
      let code = ""
      for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length))
      }
      return code
    }

    let code = generateCode()
    let attempts = 0

    // Verificar se codigo ja existe
    while (attempts < 10) {
      const { data: existing } = await admin
        .from("profiles")
        .select("id")
        .eq("affiliate_code", code)
        .maybeSingle()

      if (!existing) break
      code = generateCode()
      attempts++
    }

    const settings = await getAffiliateSettings(admin)

    if (!settings.program_enabled) {
      return NextResponse.json({ error: "O programa de afiliados esta temporariamente fechado" }, { status: 403 })
    }

    // Atualizar perfil para ser afiliado (via admin to bypass RLS)
    const { data: updatedProfile, error } = await admin
      .from("profiles")
      .update({
        is_affiliate: true,
        affiliate_code: code,
        affiliate_status: settings.auto_approve_affiliates ? "active" : "pending",
        affiliate_commission_percent: settings.default_revshare_percent,
        affiliate_cpa_amount: settings.default_cpa_amount,
        affiliate_cpa_min_deposit: settings.cpa_min_deposit,
        affiliate_sub_percent: settings.sub_affiliate_percent,
        affiliate_balance: 0,
        affiliate_total_earned: 0,
        affiliate_total_referrals: 0,
      })
      .eq("id", user.id)
      .select()
      .single()

    if (error) {
      console.log("[v0] Affiliate POST - Update error:", error)
      return NextResponse.json({ error: "Erro ao ativar afiliado" }, { status: 500 })
    }

    console.log("[v0] Affiliate POST - Success:", updatedProfile)

    return NextResponse.json({
      affiliate: {
        id: user.id,
        user_id: user.id,
        code: updatedProfile.affiliate_code,
        commission_rate: updatedProfile.affiliate_commission_percent,
        balance: updatedProfile.affiliate_balance || 0,
        status: updatedProfile.affiliate_status,
        total_earned: 0,
        total_referrals: 0,
        referrals_with_deposit: 0,
      },
    })
  } catch (error) {
    console.log("[v0] Affiliate POST - Error:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
