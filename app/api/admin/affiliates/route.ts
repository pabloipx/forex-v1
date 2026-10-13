import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"
import {
  getAffiliateSettings,
  resolveTerms,
  round2,
  type AffiliateGlobalSettings,
  type CommissionModel,
} from "@/lib/affiliate-commission"
import { isAdminRequest } from "@/lib/admin/session"
import { accrueTradeRevshareForAll } from "@/lib/affiliate-revshare"


async function checkToken(): Promise<boolean> {
  return isAdminRequest()
}

const AFFILIATE_FIELDS =
  "id, full_name, email, affiliate_code, affiliate_status, affiliate_commission_percent, affiliate_cpa_amount, affiliate_commission_model, affiliate_cpa_min_deposit, affiliate_sub_percent, affiliate_notes, affiliate_balance, affiliate_total_earned, affiliate_total_referrals, created_at"

const sum = (rows: Array<Record<string, unknown>>, key: string) =>
  round2(rows.reduce((acc, row) => acc + (Number(row[key]) || 0), 0))

type Row = Record<string, any>

/** Agrega métricas por afiliado a partir das listas já carregadas. */
function buildMetrics(input: {
  affiliates: Row[]
  referrals: Row[]
  deposits: Row[]
  trades: Row[]
  commissions: Row[]
  withdrawals: Row[]
  settings: AffiliateGlobalSettings
}) {
  const { affiliates, referrals, deposits, trades, commissions, withdrawals, settings } = input

  const depositsByUser = new Map<string, Row[]>()
  for (const d of deposits) {
    const list = depositsByUser.get(d.user_id) ?? []
    list.push(d)
    depositsByUser.set(d.user_id, list)
  }

  const tradesByUser = new Map<string, Row[]>()
  for (const t of trades) {
    const list = tradesByUser.get(t.user_id) ?? []
    list.push(t)
    tradesByUser.set(t.user_id, list)
  }

  const referralsByCode = new Map<string, Row[]>()
  for (const r of referrals) {
    if (!r.referred_by) continue
    const list = referralsByCode.get(r.referred_by) ?? []
    list.push(r)
    referralsByCode.set(r.referred_by, list)
  }

  const commissionsByAffiliate = new Map<string, Row[]>()
  for (const c of commissions) {
    const list = commissionsByAffiliate.get(c.affiliate_id) ?? []
    list.push(c)
    commissionsByAffiliate.set(c.affiliate_id, list)
  }

  const withdrawalsByAffiliate = new Map<string, Row[]>()
  for (const w of withdrawals) {
    const list = withdrawalsByAffiliate.get(w.affiliate_id) ?? []
    list.push(w)
    withdrawalsByAffiliate.set(w.affiliate_id, list)
  }

  return affiliates.map((a) => {
    const code = a.affiliate_code || ""
    const myReferrals = referralsByCode.get(code) ?? []
    const myCommissions = commissionsByAffiliate.get(a.id) ?? []
    const myWithdrawals = withdrawalsByAffiliate.get(a.id) ?? []
    const terms = resolveTerms(a, settings)

    let depositTotal = 0
    let depositCount = 0
    let depositorCount = 0
    let tradeVolume = 0
    let netRevenue = 0

    for (const referral of myReferrals) {
      const userDeposits = (depositsByUser.get(referral.id) ?? []).filter((d) =>
        ["approved", "completed", "paid"].includes(String(d.status || "").toLowerCase()),
      )
      if (userDeposits.length > 0) depositorCount += 1
      depositCount += userDeposits.length
      depositTotal += userDeposits.reduce((acc, d) => acc + (Number(d.amount) || 0), 0)

      const userTrades = (tradesByUser.get(referral.id) ?? []).filter((t) => t.is_demo !== true)
      tradeVolume += userTrades.reduce((acc, t) => acc + (Number(t.amount) || 0), 0)
      // Receita da casa = negativo do lucro do jogador
      netRevenue -= userTrades.reduce((acc, t) => acc + (Number(t.profit) || 0), 0)
    }

    const cpaEarned = sum(myCommissions, "cpa_amount")
    // A coluna do valor da comissao e `amount` (nao `commission_amount`), por isso o total
    // aparecia sempre zerado no painel mesmo havendo comissoes registradas.
    const commissionTotal = sum(myCommissions, "amount")
    // Le a coluna `revshare_amount` direto, em vez de deduzir por subtracao: com o RevShare
    // vindo das operacoes, as duas parcelas vivem em linhas separadas e a subtracao poderia
    // mascarar divergencias.
    const revshareEarned = sum(myCommissions, "revshare_amount")
    const paidOut = sum(
      myWithdrawals.filter((w) => ["approved", "completed"].includes(String(w.status || "").toLowerCase())),
      "amount",
    )
    const pendingPayout = sum(
      myWithdrawals.filter((w) => String(w.status || "").toLowerCase() === "pending"),
      "amount",
    )

    return {
      id: a.id,
      code: code || "N/A",
      name: a.full_name || "Sem nome",
      email: a.email || "",
      status: a.affiliate_status || "active",
      created_at: a.created_at,
      notes: a.affiliate_notes || "",
      terms: {
        model: terms.model as CommissionModel,
        revshare_percent: terms.revsharePercent,
        cpa_amount: terms.cpaAmount,
        cpa_min_deposit: terms.cpaMinDeposit,
        sub_percent: terms.subPercent,
      },
      balance: round2(a.affiliate_balance || 0),
      total_earned: round2(a.affiliate_total_earned || 0),
      revshare_earned: revshareEarned,
      cpa_earned: cpaEarned,
      paid_out: paidOut,
      pending_payout: pendingPayout,
      referrals: myReferrals.length,
      depositors: depositorCount,
      deposit_count: depositCount,
      deposit_total: round2(depositTotal),
      trade_volume: round2(tradeVolume),
      net_revenue: round2(netRevenue),
      conversion_rate: myReferrals.length > 0 ? round2((depositorCount / myReferrals.length) * 100) : 0,
      avg_deposit: depositCount > 0 ? round2(depositTotal / depositCount) : 0,
      margin: netRevenue > 0 ? round2(((netRevenue - commissionTotal) / netRevenue) * 100) : 0,
      last_commission_at: myCommissions[0]?.created_at ?? null,
    }
  })
}

export async function GET(request: Request) {
  try {
    if (!(await checkToken())) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 403 })
    }

    const supabase = createAdminClient()
    const url = new URL(request.url)
    const affiliateId = url.searchParams.get("affiliateId")

    const settings = await getAffiliateSettings(supabase)

    // Reapura o RevShare das operacoes de todos os afiliados ativos antes de montar o relatorio,
    // para o admin ver valores atualizados. Idempotente e nunca lanca excecao.
    await accrueTradeRevshareForAll(supabase)

    const [{ data: affiliates }, { data: referrals }, { data: commissions }, { data: withdrawals }] = await Promise.all(
      [
        supabase.from("profiles").select(AFFILIATE_FIELDS).eq("is_affiliate", true).order("created_at", {
          ascending: false,
        }),
        supabase
          .from("profiles")
          .select("id, full_name, email, referred_by, created_at, balance")
          .not("referred_by", "is", null),
        supabase.from("affiliate_commissions").select("*").order("created_at", { ascending: false }).limit(3000),
        supabase.from("affiliate_withdrawals").select("*").order("created_at", { ascending: false }).limit(1000),
      ],
    )

    const referralList = referrals ?? []
    const referralIds = referralList.map((r) => r.id)

    let deposits: Row[] = []
    let trades: Row[] = []

    if (referralIds.length > 0) {
      const [depositsRes, tradesRes] = await Promise.all([
        supabase.from("deposits").select("id, user_id, amount, status, method, created_at").in("user_id", referralIds),
        supabase.from("trades").select("user_id, amount, profit, result, is_demo, created_at").in("user_id", referralIds),
      ])
      deposits = depositsRes.data ?? []
      trades = tradesRes.data ?? []
    }

    const metrics = buildMetrics({
      affiliates: affiliates ?? [],
      referrals: referralList,
      deposits,
      trades,
      commissions: commissions ?? [],
      withdrawals: withdrawals ?? [],
      settings,
    })

    const profileById = new Map((affiliates ?? []).map((a) => [a.id, a]))
    const referralById = new Map(referralList.map((r) => [r.id, r]))

    const decorateWithdrawal = (w: Row): Row => {
      const profile = profileById.get(w.affiliate_id)
      return {
        ...w,
        amount: round2(w.amount || 0),
        fee: round2(w.fee || 0),
        net_amount: round2(w.net_amount || 0),
        profile: profile
          ? { full_name: profile.full_name, email: profile.email, affiliate_code: profile.affiliate_code }
          : null,
      }
    }

    const allWithdrawals = (withdrawals ?? []).map(decorateWithdrawal)
    const pendingWithdrawals = allWithdrawals.filter((w) => String(w.status).toLowerCase() === "pending")
    const processedWithdrawals = allWithdrawals
      .filter((w) => String(w.status).toLowerCase() !== "pending")
      .slice(0, 100)

    const recentCommissions = (commissions ?? []).slice(0, 100).map((c) => {
      const affiliate = profileById.get(c.affiliate_id)
      const referred = referralById.get(c.referred_user_id)
      return {
        id: c.id,
        created_at: c.created_at,
        deposit_amount: round2(c.deposit_amount || c.base_amount || 0),
        // As chaves de saida seguem iguais (a UI ja as consome); apenas passam a ler as
        // colunas que realmente existem: amount, percent e type.
        commission_amount: round2(c.amount || 0),
        commission_percent: Number(c.percent) || 0,
        cpa_amount: round2(c.cpa_amount || 0),
        commission_model: c.type || "revshare",
        affiliate_name: affiliate?.full_name || "—",
        affiliate_code: affiliate?.affiliate_code || "—",
        referred_name: referred?.full_name || referred?.email || "Usuario",
      }
    })

    const { data: logs } = await supabase
      .from("affiliate_admin_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(60)

    const decoratedLogs = (logs ?? []).map((l) => ({
      ...l,
      affiliate_name: profileById.get(l.affiliate_id)?.full_name || null,
    }))

    // Detalhe individual: referidos do afiliado selecionado
    let detail: Row | null = null
    if (affiliateId) {
      const target = profileById.get(affiliateId)
      const metric = metrics.find((m) => m.id === affiliateId)
      if (target && metric) {
        const code = target.affiliate_code || ""
        const myReferrals = referralList
          .filter((r) => r.referred_by === code)
          .map((r) => {
            const userDeposits = deposits.filter(
              (d) => d.user_id === r.id && ["approved", "completed", "paid"].includes(String(d.status).toLowerCase()),
            )
            const userTrades = trades.filter((t) => t.user_id === r.id && t.is_demo !== true)
            return {
              id: r.id,
              name: r.full_name || "Sem nome",
              email: r.email || "",
              created_at: r.created_at,
              balance: round2(r.balance || 0),
              deposit_total: sum(userDeposits, "amount"),
              deposit_count: userDeposits.length,
              trade_count: userTrades.length,
              trade_volume: sum(userTrades, "amount"),
              net_revenue: round2(-sum(userTrades, "profit")),
            }
          })
          .sort((a, b) => b.deposit_total - a.deposit_total)

        detail = {
          ...metric,
          referral_list: myReferrals,
          commissions: recentCommissions.filter((c) => c.affiliate_code === code).slice(0, 40),
          withdrawals: allWithdrawals.filter((w) => w.affiliate_id === affiliateId).slice(0, 40),
          logs: decoratedLogs.filter((l) => l.affiliate_id === affiliateId).slice(0, 30),
        }
      }
    }

    const activeAffiliates = metrics.filter((m) => m.status === "active")
    const totals = {
      totalAffiliates: metrics.length,
      activeAffiliates: activeAffiliates.length,
      blockedAffiliates: metrics.filter((m) => m.status === "blocked").length,
      totalReferrals: metrics.reduce((acc, m) => acc + m.referrals, 0),
      totalDepositors: metrics.reduce((acc, m) => acc + m.depositors, 0),
      totalDeposited: round2(metrics.reduce((acc, m) => acc + m.deposit_total, 0)),
      totalEarned: round2(metrics.reduce((acc, m) => acc + m.total_earned, 0)),
      totalRevshare: round2(metrics.reduce((acc, m) => acc + m.revshare_earned, 0)),
      totalCpa: round2(metrics.reduce((acc, m) => acc + m.cpa_earned, 0)),
      totalBalance: round2(metrics.reduce((acc, m) => acc + m.balance, 0)),
      totalPaidOut: round2(metrics.reduce((acc, m) => acc + m.paid_out, 0)),
      pendingPayout: round2(metrics.reduce((acc, m) => acc + m.pending_payout, 0)),
      pendingCount: pendingWithdrawals.length,
      netRevenue: round2(metrics.reduce((acc, m) => acc + m.net_revenue, 0)),
    }

    return NextResponse.json({
      affiliates: metrics,
      stats: totals,
      pendingWithdrawals,
      processedWithdrawals,
      commissions: recentCommissions,
      logs: decoratedLogs,
      settings,
      detail,
    })
  } catch (error) {
    console.error("[v0] Erro ao buscar afiliados:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    if (!(await checkToken())) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 403 })
    }

    const supabase = createAdminClient()
    const { affiliateId, action, data } = await request.json()

    const log = (entry: {
      affiliate_id?: string | null
      action: string
      field?: string
      old_value?: string | null
      new_value?: string | null
      note?: string | null
    }) => supabase.from("affiliate_admin_logs").insert(entry)

    if (action === "update_terms") {
      if (!affiliateId) return NextResponse.json({ error: "Afiliado nao informado" }, { status: 400 })

      const { data: current } = await supabase
        .from("profiles")
        .select(
          "affiliate_commission_percent, affiliate_cpa_amount, affiliate_commission_model, affiliate_cpa_min_deposit, affiliate_sub_percent",
        )
        .eq("id", affiliateId)
        .single()

      const revshare = Number(data.revshare_percent)
      const cpa = Number(data.cpa_amount)
      const cpaMin = Number(data.cpa_min_deposit)
      const subPercent = Number(data.sub_percent)
      const model = data.model

      if (!["revshare", "cpa", "hybrid"].includes(model)) {
        return NextResponse.json({ error: "Modelo de comissao invalido" }, { status: 400 })
      }
      if (!Number.isFinite(revshare) || revshare < 0 || revshare > 100) {
        return NextResponse.json({ error: "RevShare deve estar entre 0 e 100" }, { status: 400 })
      }
      if (!Number.isFinite(cpa) || cpa < 0 || cpa > 100000) {
        return NextResponse.json({ error: "Valor de CPA invalido" }, { status: 400 })
      }
      if (!Number.isFinite(cpaMin) || cpaMin < 0) {
        return NextResponse.json({ error: "Deposito minimo de CPA invalido" }, { status: 400 })
      }
      if (!Number.isFinite(subPercent) || subPercent < 0 || subPercent > 100) {
        return NextResponse.json({ error: "Percentual de sub-afiliado invalido" }, { status: 400 })
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          affiliate_commission_percent: revshare,
          affiliate_cpa_amount: cpa,
          affiliate_cpa_min_deposit: cpaMin,
          affiliate_sub_percent: subPercent,
          affiliate_commission_model: model,
          affiliate_notes: typeof data.notes === "string" ? data.notes.slice(0, 1000) : undefined,
        })
        .eq("id", affiliateId)

      if (error) throw error

      const oldValue = `${current?.affiliate_commission_model ?? "hybrid"} · rev ${Number(current?.affiliate_commission_percent ?? 0)}% · cpa ${Number(current?.affiliate_cpa_amount ?? 0)}`
      const newValue = `${model} · rev ${revshare}% · cpa ${cpa}`

      // Registra a auditoria somente quando os termos realmente mudam
      if (oldValue !== newValue) {
        await log({
          affiliate_id: affiliateId,
          action: "update_terms",
          field: "cpa/revshare",
          old_value: oldValue,
          new_value: newValue,
          note: data.reason || null,
        })
      }

      return NextResponse.json({ success: true })
    }

    if (action === "update_status") {
      if (!affiliateId) return NextResponse.json({ error: "Afiliado nao informado" }, { status: 400 })
      if (!["active", "blocked", "pending"].includes(data.status)) {
        return NextResponse.json({ error: "Status invalido" }, { status: 400 })
      }

      const { data: current } = await supabase
        .from("profiles")
        .select("affiliate_status")
        .eq("id", affiliateId)
        .single()

      const { error } = await supabase.from("profiles").update({ affiliate_status: data.status }).eq("id", affiliateId)
      if (error) throw error

      await log({
        affiliate_id: affiliateId,
        action: "update_status",
        field: "affiliate_status",
        old_value: current?.affiliate_status ?? null,
        new_value: data.status,
        note: data.reason || null,
      })

      return NextResponse.json({ success: true })
    }

    if (action === "adjust_balance") {
      if (!affiliateId) return NextResponse.json({ error: "Afiliado nao informado" }, { status: 400 })

      const delta = Number(data.delta)
      if (!Number.isFinite(delta) || delta === 0) {
        return NextResponse.json({ error: "Informe um valor de ajuste diferente de zero" }, { status: 400 })
      }

      const { data: current } = await supabase
        .from("profiles")
        .select("affiliate_balance, affiliate_total_earned")
        .eq("id", affiliateId)
        .single()

      const previous = Number(current?.affiliate_balance) || 0
      const next = round2(previous + delta)

      if (next < 0) {
        return NextResponse.json({ error: "O ajuste deixaria o saldo negativo" }, { status: 400 })
      }

      const update: Record<string, number> = { affiliate_balance: next }
      if (delta > 0) {
        update.affiliate_total_earned = round2((Number(current?.affiliate_total_earned) || 0) + delta)
      }

      const { error } = await supabase.from("profiles").update(update).eq("id", affiliateId)
      if (error) throw error

      await log({
        affiliate_id: affiliateId,
        action: "adjust_balance",
        field: "affiliate_balance",
        old_value: previous.toFixed(2),
        new_value: next.toFixed(2),
        note: data.reason || null,
      })

      return NextResponse.json({ success: true, balance: next })
    }

    if (action === "process_withdrawal") {
      const { withdrawalId, status, note } = data

      if (!withdrawalId) {
        return NextResponse.json({ error: "ID do saque nao informado" }, { status: 400 })
      }
      if (!["approved", "completed", "rejected"].includes(status)) {
        return NextResponse.json({ error: "Status invalido" }, { status: 400 })
      }

      const { data: withdrawal, error: fetchError } = await supabase
        .from("affiliate_withdrawals")
        .select("*")
        .eq("id", withdrawalId)
        .single()

      if (fetchError || !withdrawal) {
        return NextResponse.json({ error: "Saque nao encontrado" }, { status: 404 })
      }
      if (String(withdrawal.status).toLowerCase() !== "pending") {
        return NextResponse.json({ error: "Este saque ja foi processado" }, { status: 409 })
      }

      // Rejeição devolve o valor ao saldo do afiliado
      if (status === "rejected") {
        const { data: profile } = await supabase
          .from("profiles")
          .select("affiliate_balance")
          .eq("id", withdrawal.affiliate_id)
          .single()

        await supabase
          .from("profiles")
          .update({ affiliate_balance: round2((Number(profile?.affiliate_balance) || 0) + (withdrawal.amount || 0)) })
          .eq("id", withdrawal.affiliate_id)
      }

      const finalStatus = status === "completed" ? "approved" : status
      const { error: updateError } = await supabase
        .from("affiliate_withdrawals")
        .update({
          status: finalStatus,
          admin_notes: typeof note === "string" && note ? note.slice(0, 500) : withdrawal.admin_notes,
          processed_at: new Date().toISOString(),
        })
        .eq("id", withdrawalId)

      if (updateError) throw updateError

      await log({
        affiliate_id: withdrawal.affiliate_id,
        action: "process_withdrawal",
        field: "status",
        old_value: "pending",
        new_value: finalStatus,
        note: `R$ ${Number(withdrawal.amount || 0).toFixed(2)}${note ? ` · ${note}` : ""}`,
      })

      return NextResponse.json({ success: true })
    }

    if (action === "update_settings") {
      const payload = {
        default_revshare_percent: Number(data.default_revshare_percent),
        default_cpa_amount: Number(data.default_cpa_amount),
        cpa_min_deposit: Number(data.cpa_min_deposit),
        sub_affiliate_percent: Number(data.sub_affiliate_percent),
        min_withdrawal: Number(data.min_withdrawal),
        withdrawal_fee_percent: Number(data.withdrawal_fee_percent),
        program_enabled: Boolean(data.program_enabled),
        auto_approve_affiliates: Boolean(data.auto_approve_affiliates),
        display_currency: data.display_currency === "USD" ? "USD" : "BRL",
        usd_rate: Number(data.usd_rate),
        // Campo opcional: vazio limpa a data e o painel volta para a janela automatica
        next_payment_date: data.next_payment_date ? String(data.next_payment_date) : null,
      }

      for (const [key, value] of Object.entries(payload)) {
        if (typeof value === "number" && (!Number.isFinite(value) || value < 0)) {
          return NextResponse.json({ error: `Valor invalido em ${key}` }, { status: 400 })
        }
      }
      if (payload.default_revshare_percent > 100 || payload.withdrawal_fee_percent > 100) {
        return NextResponse.json({ error: "Percentuais devem estar entre 0 e 100" }, { status: 400 })
      }
      // Cotacao zerada dividiria por zero na conversao exibida ao afiliado
      if (payload.usd_rate <= 0) {
        return NextResponse.json({ error: "Informe uma cotacao do dolar maior que zero" }, { status: 400 })
      }
      if (payload.next_payment_date && Number.isNaN(Date.parse(payload.next_payment_date))) {
        return NextResponse.json({ error: "Data do proximo pagamento invalida" }, { status: 400 })
      }

      const { error } = await supabase
        .from("affiliate_global_settings")
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq("id", 1)

      if (error) throw error

      await log({
        action: "update_settings",
        field: "global",
        new_value: `rev ${payload.default_revshare_percent}% · cpa R$ ${payload.default_cpa_amount} · min saque R$ ${payload.min_withdrawal} · moeda ${payload.display_currency}${payload.display_currency === "USD" ? ` (${payload.usd_rate})` : ""} · pagamento ${payload.next_payment_date ?? "automatico"}`,
      })

      return NextResponse.json({ success: true })
    }

    if (action === "apply_defaults_to_all") {
      const settings = await getAffiliateSettings(supabase)
      const { error } = await supabase
        .from("profiles")
        .update({
          affiliate_commission_percent: settings.default_revshare_percent,
          affiliate_cpa_amount: settings.default_cpa_amount,
          affiliate_cpa_min_deposit: settings.cpa_min_deposit,
          affiliate_sub_percent: settings.sub_affiliate_percent,
        })
        .eq("is_affiliate", true)

      if (error) throw error

      await log({
        action: "apply_defaults_to_all",
        field: "cpa/revshare",
        new_value: `rev ${settings.default_revshare_percent}% · cpa R$ ${settings.default_cpa_amount}`,
      })

      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "Acao invalida" }, { status: 400 })
  } catch (error) {
    console.error("[v0] Erro ao atualizar afiliado:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
