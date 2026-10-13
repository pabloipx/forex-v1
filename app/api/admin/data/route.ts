import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { approveDeposit } from "@/lib/deposits"
import { isAdminRequest } from "@/lib/admin/session"
import { round2 } from "@/lib/promo-codes"
import { buildAiTradeRow, iaEntryForResult, IA_MIN_ENTRY } from "@/lib/ia-trades"

// Dia atual no fuso America/Sao_Paulo (UTC-3), igual ao usado no acerto da IA.
const iaTodayKey = () => new Date(Date.now() - 3 * 3_600_000).toISOString().slice(0, 10)


function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY || ""

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

async function checkAuth(): Promise<boolean> {
  return isAdminRequest()
}

export async function GET(req: NextRequest) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 })
  }

  try {
    const supabase = getAdminClient()
    const { searchParams } = new URL(req.url)
    const type = searchParams.get("type")

    if (type === "stats") {
      const [usersRes, depositsRes, withdrawalsRes, tradesRes, balancesRes, kycRes] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact" }),
        supabase.from("deposits").select("amount, status"),
        supabase.from("withdrawals").select("amount, status"),
        supabase.from("trades").select("amount, profit, result, is_demo"),
        supabase.from("user_balances").select("balance_real, balance_demo"),
        supabase.from("kyc_requests").select("status"),
      ])

      const totalUsers = usersRes.count || 0
      const deposits = depositsRes.data || []
      const totalDeposited = deposits
        .filter((d: any) => d.status === "completed" || d.status === "approved")
        .reduce((sum: number, d: any) => sum + Number(d.amount || 0), 0)
      const pendingDeposits = deposits.filter((d: any) => d.status === "pending").length

      const withdrawals = withdrawalsRes.data || []
      const totalWithdrawn = withdrawals
        .filter((w: any) => w.status === "completed" || w.status === "approved")
        .reduce((sum: number, w: any) => sum + Number(w.amount || 0), 0)
      const pendingWithdrawals = withdrawals.filter((w: any) => w.status === "pending").length

      const trades = tradesRes.data || []
      const realTrades = trades.filter((t: any) => !t.is_demo)
      const totalTrades = realTrades.length
      const platformProfit =
        realTrades
          .filter((t: any) => t.result === "loss")
          .reduce((sum: number, t: any) => sum + Number(t.amount || 0), 0) -
        realTrades
          .filter((t: any) => t.result === "win")
          .reduce((sum: number, t: any) => sum + Number(t.profit || 0), 0)

      const balances = balancesRes.data || []
      const totalBalanceReal = balances.reduce((sum: number, b: any) => sum + Number(b.balance_real || 0), 0)

      const kycRequests = kycRes.data || []
      const pendingKyc = kycRequests.filter((k: any) => k.status === "pending").length

      return NextResponse.json({
        totalUsers,
        totalDeposited,
        totalWithdrawn,
        totalTrades,
        platformProfit,
        pendingDeposits,
        pendingWithdrawals,
        totalBalanceReal,
        pendingKyc,
      })
    }

    if (type === "users") {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false })

      if (profilesError) throw profilesError
      if (!profiles || profiles.length === 0) return NextResponse.json({ users: [] })

      const userIds = profiles.map((p: any) => p.id)
      const { data: balances } = await supabase.from("user_balances").select("*").in("user_id", userIds)

      // Travas de rollover ativas de todos os usuarios, para mostrar quanto falta em cada card.
      const { data: rollovers } = await supabase
        .from("deposit_rollovers")
        .select("user_id, rollover_required, rollover_progress")
        .eq("status", "active")
        .in("user_id", userIds)

      // Consolida as travas ativas por usuario: soma exigido e progresso, calcula o restante.
      const rolloverByUser = new Map<string, { required: number; progress: number; remaining: number; count: number }>()
      for (const r of rollovers || []) {
        const current = rolloverByUser.get(r.user_id) || { required: 0, progress: 0, remaining: 0, count: 0 }
        current.required = round2(current.required + Number(r.rollover_required || 0))
        current.progress = round2(current.progress + Number(r.rollover_progress || 0))
        current.count += 1
        current.remaining = round2(Math.max(0, current.required - current.progress))
        rolloverByUser.set(r.user_id, current)
      }

      const users = profiles.map((profile: any) => {
        const balance = balances?.find((b: any) => b.user_id === profile.id)
        return {
          ...profile,
          balance_real: balance?.balance_real || 0,
          balance_demo: balance?.balance_demo || 100,
          rollover: rolloverByUser.get(profile.id) || null,
        }
      })

      return NextResponse.json({ users })
    }

    if (type === "deposits") {
      const { data: deposits, error: depositsError } = await supabase
        .from("deposits")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100)

      if (depositsError) throw depositsError
      if (!deposits || deposits.length === 0) return NextResponse.json({ deposits: [] })

      const userIds = [...new Set(deposits.map((d: any) => d.user_id))]
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", userIds)

      const depositsWithProfiles = deposits.map((deposit: any) => {
        const profile = profiles?.find((p: any) => p.id === deposit.user_id)
        return {
          ...deposit,
          user_name: profile?.full_name || "Usuario",
          user_email: profile?.email || "Email nao encontrado",
        }
      })

      return NextResponse.json({ deposits: depositsWithProfiles })
    }

    if (type === "withdrawals") {
      const { data: withdrawals, error: withdrawalsError } = await supabase
        .from("withdrawals")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100)

      if (withdrawalsError) throw withdrawalsError
      if (!withdrawals || withdrawals.length === 0) return NextResponse.json({ withdrawals: [] })

      const userIds = [...new Set(withdrawals.map((w: any) => w.user_id))]
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", userIds)

      const withdrawalsWithProfiles = withdrawals.map((withdrawal: any) => {
        const profile = profiles?.find((p: any) => p.id === withdrawal.user_id)
        return {
          ...withdrawal,
          user_name: profile?.full_name || "Usuario",
          user_email: profile?.email || "Email nao encontrado",
        }
      })

      return NextResponse.json({ withdrawals: withdrawalsWithProfiles })
    }

    if (type === "kyc") {
      const { data: kycRequests, error: kycError } = await supabase
        .from("kyc_requests")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100)

      if (kycError) throw kycError
      if (!kycRequests || kycRequests.length === 0) return NextResponse.json({ kycRequests: [] })

      const userIds = [...new Set(kycRequests.map((k: any) => k.user_id))]
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", userIds)

      const kycWithProfiles = kycRequests.map((kyc: any) => {
        const profile = profiles?.find((p: any) => p.id === kyc.user_id)
        return {
          ...kyc,
          user_name: profile?.full_name || "Usuario",
          user_email: profile?.email || "Email nao encontrado",
        }
      })

      return NextResponse.json({ kycRequests: kycWithProfiles })
    }

    if (type === "ia_users") {
      // Estados do Robô de IA ficam em platform_settings, chave ia_broker_state:<userId>.
      const { data: settings, error: settingsError } = await supabase
        .from("platform_settings")
        .select("setting_key, setting_value, updated_at")
        .like("setting_key", "ia_broker_state:%")

      if (settingsError) throw settingsError

      const parsed = (settings || [])
        .map((row: any) => {
          const userId = String(row.setting_key).replace("ia_broker_state:", "")
          let value: any = null
          try {
            value = typeof row.setting_value === "string" ? JSON.parse(row.setting_value) : row.setting_value
          } catch {
            value = null
          }
          return { userId, value, updatedAt: row.updated_at }
        })
        .filter((r: any) => r.value && r.value.active)

      if (parsed.length === 0) return NextResponse.json({ iaUsers: [] })

      const userIds = parsed.map((p: any) => p.userId)
      const [{ data: profiles }, { data: balances }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, email").in("id", userIds),
        supabase.from("user_balances").select("user_id, balance_real").in("user_id", userIds),
      ])

      const iaUsers = parsed
        .map((p: any) => {
          const profile = profiles?.find((x: any) => x.id === p.userId)
          const balance = balances?.find((b: any) => b.user_id === p.userId)
          const s = p.value
          const dailyMeta = round2(Number(s.amount || 0) * (Number(s.daily || 0) / 100))
          const hasOverride =
            s.metaOverride != null && Number.isFinite(Number(s.metaOverride)) && Number(s.metaOverride) >= 0
          const effectiveMeta = hasOverride ? round2(Number(s.metaOverride)) : dailyMeta
          // Resultado líquido de hoje (com sinal). Se o dia salvo não é hoje, o dia atual começa zerado.
          const isToday = s.dayKey === iaTodayKey()
          const todayResult = isToday
            ? s.lossMode
              ? round2(-Number(s.lostToday || 0))
              : round2(Number(s.creditedToday || 0))
            : 0
          return {
            userId: p.userId,
            user_name: profile?.full_name || "Usuario",
            user_email: profile?.email || "Email nao encontrado",
            balance_real: Number(balance?.balance_real || 0),
            planId: s.planId || "",
            amount: Number(s.amount || 0),
            daily: Number(s.daily || 0),
            dailyMeta,
            metaOverride: hasOverride ? round2(Number(s.metaOverride)) : null,
            effectiveMeta,
            earningEnabled: s.earningEnabled !== false,
            lossMode: !!s.lossMode,
            lossPerDay:
              s.lossPerDay != null && Number.isFinite(Number(s.lossPerDay)) ? round2(Number(s.lossPerDay)) : null,
            lostToday: round2(Number(s.lostToday || 0)),
            totalCredited: round2(Number(s.totalCredited || 0)),
            creditedToday: round2(Number(s.creditedToday || 0)),
            todayResult,
            tradesToday: isToday ? Number(s.tradesToday || 0) : 0,
            tradesTotal: Number(s.tradesTotal || 0),
            dayLocked: !!s.dayLockedKey && s.dayLockedKey === iaTodayKey(),
            assertiveness: Number(s.assertiveness ?? 87),
            paused: !!s.paused,
            activatedAt: s.activatedAt || null,
            updatedAt: p.updatedAt,
          }
        })
        .sort((a: any, b: any) => new Date(b.activatedAt || 0).getTime() - new Date(a.activatedAt || 0).getTime())

      return NextResponse.json({ iaUsers })
    }

    if (type === "ia_user_detail") {
      const userId = searchParams.get("userId") || ""
      if (!userId) return NextResponse.json({ error: "userId obrigatorio" }, { status: 400 })

      const settingKey = `ia_broker_state:${userId}`
      const [{ data: setting }, { data: profile }, { data: balance }, { data: txs }] = await Promise.all([
        supabase.from("platform_settings").select("setting_value, updated_at").eq("setting_key", settingKey).maybeSingle(),
        supabase.from("profiles").select("id, full_name, email, phone, created_at").eq("id", userId).maybeSingle(),
        supabase.from("user_balances").select("balance_real").eq("user_id", userId).maybeSingle(),
        // Histórico de movimentações geradas pela IA (investimento, rendimentos, devolução).
        supabase
          .from("transactions")
          .select("id, type, amount, balance_after, description, created_at")
          .eq("user_id", userId)
          .in("type", ["ia_invest", "ia_yield", "ia_refund"])
          .order("created_at", { ascending: false })
          .limit(200),
      ])

      let state: any = null
      if (setting?.setting_value) {
        try {
          state = typeof setting.setting_value === "string" ? JSON.parse(setting.setting_value) : setting.setting_value
        } catch {
          state = null
        }
      }

      const transactions = txs || []
      const totalYield = round2(
        transactions.filter((t: any) => t.type === "ia_yield").reduce((s: number, t: any) => s + Number(t.amount || 0), 0),
      )
      const yieldCount = transactions.filter((t: any) => t.type === "ia_yield").length

      return NextResponse.json({
        detail: {
          userId,
          user_name: profile?.full_name || "Usuario",
          user_email: profile?.email || "Email nao encontrado",
          phone: profile?.phone || null,
          member_since: profile?.created_at || null,
          balance_real: Number(balance?.balance_real || 0),
          active: !!state?.active,
          paused: !!state?.paused,
          planId: state?.planId || "",
          amount: Number(state?.amount || 0),
          daily: Number(state?.daily || 0),
          dailyMeta: round2(Number(state?.amount || 0) * (Number(state?.daily || 0) / 100)),
          metaOverride:
            state?.metaOverride != null && Number.isFinite(Number(state.metaOverride))
              ? round2(Number(state.metaOverride))
              : null,
          earningEnabled: state?.earningEnabled !== false,
          lossMode: !!state?.lossMode,
          lossPerDay:
            state?.lossPerDay != null && Number.isFinite(Number(state.lossPerDay))
              ? round2(Number(state.lossPerDay))
              : null,
          lostToday: round2(Number(state?.lostToday || 0)),
          totalCredited: round2(Number(state?.totalCredited || 0)),
          creditedToday: round2(Number(state?.creditedToday || 0)),
          assertiveness: Number(state?.assertiveness ?? 87),
          activatedAt: state?.activatedAt || null,
          lastSettleAt: state?.lastSettleAt || null,
          updatedAt: setting?.updated_at || null,
          totalYield,
          yieldCount,
          transactions,
        },
      })
    }

    return NextResponse.json({ error: "Tipo invalido" }, { status: 400 })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 })
  }

  try {
    const supabase = getAdminClient()
    const body = await req.json()
    const { action, data: actionData } = body

    console.log("[v0] Admin action:", action)
    console.log("[v0] Body:", JSON.stringify(body))

    // Get the actual payload - it can be in body.data or directly in body
    const payload = actionData || body

    console.log("[v0] Payload:", JSON.stringify(payload))

    if (action === "set_ia_assertiveness") {
      const userId = payload.userId
      const raw = Number(payload.assertiveness)
      if (!userId || !Number.isFinite(raw)) {
        return NextResponse.json({ error: "Dados invalidos" }, { status: 400 })
      }
      // Limita entre 1% e 100% e arredonda para inteiro.
      const assertiveness = Math.max(1, Math.min(100, Math.round(raw)))
      const settingKey = `ia_broker_state:${userId}`

      const { data: existing } = await supabase
        .from("platform_settings")
        .select("id, setting_value")
        .eq("setting_key", settingKey)
        .maybeSingle()

      if (!existing?.setting_value) {
        return NextResponse.json({ error: "Estado da IA nao encontrado" }, { status: 404 })
      }

      let state: any
      try {
        state = typeof existing.setting_value === "string" ? JSON.parse(existing.setting_value) : existing.setting_value
      } catch {
        return NextResponse.json({ error: "Estado da IA invalido" }, { status: 500 })
      }

      state.assertiveness = assertiveness
      await supabase
        .from("platform_settings")
        .update({ setting_value: JSON.stringify(state), updated_at: new Date().toISOString() })
        .eq("id", existing.id)

      return NextResponse.json({ success: true, assertiveness })
    }

    if (action === "set_ia_meta") {
      // Define (ou remove) a meta diária personalizada de um usuário na IA.
      // meta null/vazia => volta para a meta padrão do plano.
      const userId = payload.userId
      const rawMeta = payload.meta
      if (!userId) return NextResponse.json({ error: "Dados invalidos" }, { status: 400 })

      const settingKey = `ia_broker_state:${userId}`
      const { data: existing } = await supabase
        .from("platform_settings")
        .select("id, setting_value")
        .eq("setting_key", settingKey)
        .maybeSingle()

      if (!existing?.setting_value) {
        return NextResponse.json({ error: "Estado da IA nao encontrado" }, { status: 404 })
      }

      let state: any
      try {
        state = typeof existing.setting_value === "string" ? JSON.parse(existing.setting_value) : existing.setting_value
      } catch {
        return NextResponse.json({ error: "Estado da IA invalido" }, { status: 500 })
      }

      if (rawMeta === null || rawMeta === undefined || rawMeta === "") {
        state.metaOverride = null
      } else {
        const meta = Number(rawMeta)
        if (!Number.isFinite(meta) || meta < 0) {
          return NextResponse.json({ error: "Meta invalida" }, { status: 400 })
        }
        state.metaOverride = round2(meta)
      }
      // Nova meta: a IA volta a operar hoje rumo a ela.
      state.dayLockedKey = null

      await supabase
        .from("platform_settings")
        .update({ setting_value: JSON.stringify(state), updated_at: new Date().toISOString() })
        .eq("id", existing.id)

      const effectiveMeta =
        state.metaOverride != null
          ? state.metaOverride
          : round2(Number(state.amount || 0) * (Number(state.daily || 0) / 100))

      return NextResponse.json({ success: true, metaOverride: state.metaOverride, effectiveMeta })
    }

    if (action === "set_ia_earning") {
      // Liga/desliga o rendimento de um usuário na IA. Desligado, nada é creditado.
      const userId = payload.userId
      const enabled = !!payload.enabled
      if (!userId) return NextResponse.json({ error: "Dados invalidos" }, { status: 400 })

      const settingKey = `ia_broker_state:${userId}`
      const { data: existing } = await supabase
        .from("platform_settings")
        .select("id, setting_value")
        .eq("setting_key", settingKey)
        .maybeSingle()

      if (!existing?.setting_value) {
        return NextResponse.json({ error: "Estado da IA nao encontrado" }, { status: 404 })
      }

      let state: any
      try {
        state = typeof existing.setting_value === "string" ? JSON.parse(existing.setting_value) : existing.setting_value
      } catch {
        return NextResponse.json({ error: "Estado da IA invalido" }, { status: 500 })
      }

      state.earningEnabled = enabled
      // Ao religar, zera o marco de acerto para não creditar um lote pelo tempo em que ficou desligado.
      if (enabled) state.lastSettleAt = new Date().toISOString()

      await supabase
        .from("platform_settings")
        .update({ setting_value: JSON.stringify(state), updated_at: new Date().toISOString() })
        .eq("id", existing.id)

      return NextResponse.json({ success: true, earningEnabled: enabled })
    }

    if (action === "set_ia_loss") {
      // Coloca (ou tira) o usuário no PREJUÍZO do dia. Ligado, em vez de render o saldo cai aos poucos
      // até o prejuízo alvo (lossPerDay; vazio => a magnitude da meta do plano) e as entradas do dia
      // fecham negativas no histórico da tela de TRADE. Ligar zera o dia atual para começar limpo.
      const userId = payload.userId
      const enabled = !!payload.enabled
      const rawLoss = payload.lossPerDay
      if (!userId) return NextResponse.json({ error: "Dados invalidos" }, { status: 400 })

      const settingKey = `ia_broker_state:${userId}`
      const { data: existing } = await supabase
        .from("platform_settings")
        .select("id, setting_value")
        .eq("setting_key", settingKey)
        .maybeSingle()

      if (!existing?.setting_value) {
        return NextResponse.json({ error: "Estado da IA nao encontrado" }, { status: 404 })
      }

      let state: any
      try {
        state = typeof existing.setting_value === "string" ? JSON.parse(existing.setting_value) : existing.setting_value
      } catch {
        return NextResponse.json({ error: "Estado da IA invalido" }, { status: 500 })
      }

      state.lossMode = enabled
      if (enabled) {
        if (rawLoss === null || rawLoss === undefined || rawLoss === "") {
          state.lossPerDay = null
        } else {
          const loss = Number(rawLoss)
          if (!Number.isFinite(loss) || loss < 0) {
            return NextResponse.json({ error: "Prejuizo invalido" }, { status: 400 })
          }
          state.lossPerDay = round2(loss)
        }
      }
      // Começa o dia limpo no novo modo: zera acumulados diários e o plano de entradas do dia,
      // e reancora o marco para não debitar/creditar um lote pelo tempo anterior.
      const nowIso = new Date().toISOString()
      state.lastSettleAt = nowIso
      state.creditedToday = 0
      state.lostToday = 0
      state.tradesToday = 0
      state.tradesProfitToday = 0
      state.tradesTargetToday = 8 + Math.floor(Math.random() * 5)
      state.accruedToday = 0
      state.dayLockedKey = null
      state.dayKey = iaTodayKey()

      await supabase
        .from("platform_settings")
        .update({ setting_value: JSON.stringify(state), updated_at: nowIso })
        .eq("id", existing.id)

      return NextResponse.json({
        success: true,
        lossMode: state.lossMode,
        lossPerDay: state.lossPerDay ?? null,
      })
    }

    if (action === "set_ia_paused") {
      // Pausa/retoma a IA do usuário. Pausada, o settle congela e nada é creditado,
      // mas o estado (plano, meta, acumulados) é preservado.
      const userId = payload.userId
      const paused = !!payload.paused
      if (!userId) return NextResponse.json({ error: "Dados invalidos" }, { status: 400 })

      const settingKey = `ia_broker_state:${userId}`
      const { data: existing } = await supabase
        .from("platform_settings")
        .select("id, setting_value")
        .eq("setting_key", settingKey)
        .maybeSingle()

      if (!existing?.setting_value) {
        return NextResponse.json({ error: "Estado da IA nao encontrado" }, { status: 404 })
      }

      let state: any
      try {
        state = typeof existing.setting_value === "string" ? JSON.parse(existing.setting_value) : existing.setting_value
      } catch {
        return NextResponse.json({ error: "Estado da IA invalido" }, { status: 500 })
      }

      state.paused = paused
      // Ao retomar, reancora o marco de acerto para não creditar um lote acumulado pelo tempo pausado.
      if (!paused) state.lastSettleAt = new Date().toISOString()

      await supabase
        .from("platform_settings")
        .update({ setting_value: JSON.stringify(state), updated_at: new Date().toISOString() })
        .eq("id", existing.id)

      return NextResponse.json({ success: true, paused })
    }

    if (action === "set_ia_credited_today") {
      // Define o resultado líquido de hoje na IA (positivo = ganho, negativo = perda). A diferença para
      // o resultado atual vira UMA entrada real (mín. R$1) no histórico da tela de TRADE, movimenta o
      // saldo real e trava o dia: a IA não abre novas entradas até virar o dia (ou o admin mudar a meta).
      const userId = payload.userId
      const rawTarget = Number(payload.amount)
      if (!userId || !Number.isFinite(rawTarget)) {
        return NextResponse.json({ error: "Valor invalido" }, { status: 400 })
      }
      let target = round2(rawTarget)

      const settingKey = `ia_broker_state:${userId}`
      const { data: existing } = await supabase
        .from("platform_settings")
        .select("id, setting_value")
        .eq("setting_key", settingKey)
        .maybeSingle()

      if (!existing?.setting_value) {
        return NextResponse.json({ error: "Estado da IA nao encontrado" }, { status: 404 })
      }

      let state: any
      try {
        state = typeof existing.setting_value === "string" ? JSON.parse(existing.setting_value) : existing.setting_value
      } catch {
        return NextResponse.json({ error: "Estado da IA invalido" }, { status: 500 })
      }

      const nowIso = new Date().toISOString()
      const todayKey = iaTodayKey()
      const lossMode = state.lossMode === true
      const isToday = state.dayKey === todayKey
      const currentToday = isToday
        ? lossMode
          ? round2(-Number(state.lostToday || 0))
          : round2(Number(state.creditedToday || 0))
        : 0

      const { data: bal } = await supabase
        .from("user_balances")
        .select("balance_real")
        .eq("user_id", userId)
        .maybeSingle()
      const currentBalance = Number(bal?.balance_real || 0)

      let delta = round2(target - currentToday)
      // O saldo nunca fica negativo: a perda fica limitada ao que há disponível.
      if (delta < 0 && currentBalance + delta < 0) {
        delta = -round2(currentBalance)
        target = round2(currentToday + delta)
      }
      const newBalance = round2(currentBalance + delta)

      if (delta !== 0) {
        const entry = iaEntryForResult(delta)
        const row = buildAiTradeRow(userId, entry.amount, entry.profit, 0)
        await supabase.from("trades").insert(row)
        await supabase.from("user_balances").upsert(
          { user_id: userId, balance_real: newBalance, updated_at: nowIso },
          { onConflict: "user_id" },
        )
        await supabase.from("transactions").insert({
          user_id: userId,
          type: "ia_yield",
          amount: delta,
          balance_after: newBalance,
          account_type: "real",
          description: `Operação do Robô de IA · ${row.symbol} ${row.direction === "CALL" ? "COMPRA" : "VENDA"} R$ ${Math.max(IA_MIN_ENTRY, entry.amount).toFixed(2)}`,
        })
        state.tradesToday = (isToday ? Number(state.tradesToday || 0) : 0) + 1
        state.tradesProfitToday = round2((isToday ? Number(state.tradesProfitToday || 0) : 0) + delta)
        state.tradesTotal = Number(state.tradesTotal || 0) + 1
      } else if (!isToday) {
        state.tradesToday = 0
        state.tradesProfitToday = 0
      }

      if (lossMode) {
        state.lostToday = round2(Math.max(0, -target))
        state.creditedToday = 0
      } else {
        state.creditedToday = target
      }
      state.accruedToday = Math.abs(target)
      state.dayKey = todayKey
      state.dayLockedKey = todayKey
      state.totalCredited = round2(Number(state.totalCredited || 0) + delta)
      state.lastSettleAt = nowIso

      await supabase
        .from("platform_settings")
        .update({ setting_value: JSON.stringify(state), updated_at: nowIso })
        .eq("id", existing.id)

      return NextResponse.json({
        success: true,
        creditedToday: state.creditedToday,
        lostToday: state.lostToday ?? 0,
        todayResult: target,
        tradesToday: state.tradesToday ?? 0,
        tradesTotal: state.tradesTotal ?? 0,
        dayLocked: true,
        totalCredited: state.totalCredited,
        balance_real: newBalance,
      })
    }

    if (action === "update_balance") {
      const userId = payload.userId
      const balanceReal = payload.balanceReal ?? payload.balance_real
      const balanceDemo = payload.balanceDemo ?? payload.balance_demo
      
      const { error } = await supabase.from("user_balances").upsert(
        {
          user_id: userId,
          balance_real: Number(balanceReal) || 0,
          balance_demo: Number(balanceDemo) || 0,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      )
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    if (action === "update_user") {
      // Support both camelCase and snake_case field names from frontend
      const userId = payload.userId
      const fullName = payload.fullName ?? payload.full_name
      const phone = payload.phone
      const isBlocked = payload.isBlocked ?? payload.is_blocked
      const isVerified = payload.isVerified ?? payload.is_verified
      const isAffiliate = payload.isAffiliate ?? payload.is_affiliate
      const balanceReal = payload.balanceReal ?? payload.balance_real
      const balanceDemo = payload.balanceDemo ?? payload.balance_demo

      const updateData: any = {
        updated_at: new Date().toISOString(),
      }
      
      // Only update fields that are provided
      if (fullName !== undefined) updateData.full_name = fullName
      if (phone !== undefined) updateData.phone = phone
      if (isBlocked !== undefined) updateData.is_blocked = isBlocked
      if (isVerified !== undefined) updateData.is_verified = isVerified
      if (isAffiliate !== undefined) updateData.is_affiliate = isAffiliate

      // Se marcou como afiliado e ainda nao tem codigo, gerar um
      if (isAffiliate) {
        const { data: currentProfile } = await supabase
          .from("profiles")
          .select("affiliate_code")
          .eq("id", userId)
          .single()

        if (!currentProfile?.affiliate_code) {
          const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
          let code = ""
          for (let i = 0; i < 8; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length))
          }
          updateData.affiliate_code = code
          updateData.affiliate_status = "active"
          updateData.affiliate_commission_percent = 77.0
          updateData.affiliate_balance = 0
          updateData.affiliate_total_earned = 0
          updateData.affiliate_total_referrals = 0
        }
      }

      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", userId)
      if (error) throw error
      
      // Also update balance if provided
      if (balanceReal !== undefined || balanceDemo !== undefined) {
        const { error: balanceError } = await supabase.from("user_balances").upsert(
          {
            user_id: userId,
            balance_real: Number(balanceReal) || 0,
            balance_demo: Number(balanceDemo) || 0,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" },
        )
        if (balanceError) throw balanceError
      }
      
      return NextResponse.json({ success: true })
    }

    if (action === "approve_deposit") {
      const depositId = payload.depositId
      const userId = payload.userId
      const amount = payload.amount
      
      // Validar parâmetros obrigatórios
      if (!depositId || !userId || amount === undefined) {
        return NextResponse.json({ 
          error: "Parâmetros obrigatórios: depositId, userId, amount",
          received: { depositId, userId, amount }
        }, { status: 400 })
      }
      
      // Este bloco reimplementava a aprovacao por conta propria e divergia do fluxo do webhook:
      // nao tinha protecao contra aprovacao repetida (aprovar duas vezes creditava duas vezes),
      // nao registrava a transacao no extrato, nao concedia o bonus do cupom e gravava a comissao
      // em colunas inexistentes com 77% fixo, ignorando os modelos CPA/hibrido.
      // Agora usa a MESMA funcao do webhook, que ja trata tudo isso de forma idempotente.
      const { data: deposit, error: depositFetchError } = await supabase
        .from("deposits")
        .select("id, user_id, amount, status, payment_reference")
        .eq("id", depositId)
        .maybeSingle()

      if (depositFetchError) {
        return NextResponse.json({ error: "Erro ao buscar depósito: " + depositFetchError.message }, { status: 500 })
      }

      if (!deposit) {
        return NextResponse.json({ error: "Depósito não encontrado" }, { status: 404 })
      }

      try {
        const result = await approveDeposit(supabase, deposit)

        if (result.alreadyProcessed) {
          return NextResponse.json({ success: true, alreadyProcessed: true })
        }

        return NextResponse.json({ success: true, newBalance: result.newBalance })
      } catch (approveError) {
        const message = approveError instanceof Error ? approveError.message : "Erro ao aprovar depósito"
        console.log("[v0] Erro ao aprovar deposito:", message)
        return NextResponse.json({ error: message }, { status: 500 })
      }
    }

    if (action === "reject_deposit") {
      const depositId = payload.depositId
      const { error } = await supabase
        .from("deposits")
        .update({ status: "rejected", updated_at: new Date().toISOString() })
        .eq("id", depositId)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    if (action === "approve_withdrawal") {
      const withdrawalId = payload.withdrawalId

      // O saldo JA foi debitado quando o usuario solicitou o saque (rota /api/withdraw), que e
      // tambem onde a trava de rollover e aplicada. Este bloco antes debitava o valor OUTRA VEZ,
      // entao um saque de R$ 100 tirava R$ 200 do usuario. A aprovacao agora so muda o status.
      //
      // A coluna `updated_at` nao existe em `withdrawals` (o correto e `processed_at`); usa-la
      // fazia o Postgres recusar o update e a aprovacao falhar por completo.
      const { error: withdrawalError } = await supabase
        .from("withdrawals")
        .update({ status: "completed", processed_at: new Date().toISOString() })
        .eq("id", withdrawalId)
      if (withdrawalError) throw withdrawalError

      return NextResponse.json({ success: true })
    }

    if (action === "reject_withdrawal") {
      const withdrawalId = payload.withdrawalId

      // Só devolve o saldo se o saque ainda estiver pendente. O filtro por status é o que impede
      // um clique repetido em "rejeitar" de creditar o valor mais de uma vez.
      const { data: rejected, error } = await supabase
        .from("withdrawals")
        .update({ status: "rejected", processed_at: new Date().toISOString() })
        .eq("id", withdrawalId)
        .eq("status", "pending")
        .select("user_id, amount")

      if (error) throw error

      // Como o debito acontece na solicitacao, a rejeicao PRECISA devolver o valor — sem isso o
      // usuario perderia o dinheiro de um saque recusado.
      if (rejected && rejected.length > 0) {
        const { user_id: refundUserId, amount: refundAmount } = rejected[0]

        const { data: balanceRow } = await supabase
          .from("user_balances")
          .select("balance_real")
          .eq("user_id", refundUserId)
          .maybeSingle()

        const restored = Number(balanceRow?.balance_real || 0) + Number(refundAmount)

        await supabase
          .from("user_balances")
          .update({ balance_real: restored, updated_at: new Date().toISOString() })
          .eq("user_id", refundUserId)

        await supabase.from("transactions").insert({
          user_id: refundUserId,
          type: "withdrawal_refund",
          amount: Number(refundAmount),
          balance_after: restored,
          account_type: "real",
          reference_id: withdrawalId,
          description: "Devolucao de saque rejeitado",
        })
      }

      return NextResponse.json({ success: true })
    }

    if (action === "apply_rollover") {
      // Aplica uma trava de rollover manual a um usuario ja existente (ex.: quem depositou antes
      // de o rollover ser ativado). A coluna deposit_id em deposit_rollovers e NOT NULL/UNIQUE e tem
      // foreign key para deposits(id), entao criamos um deposito "ancora" real (metodo admin, ja
      // concluido) apenas para servir de referencia. Ele NAO credita saldo (o credito e feito em
      // nivel de aplicacao no fluxo de pagamento) e NAO e reprocessado pelo cron (nao esta pendente).
      const userId = payload.userId
      const baseAmount = round2(Number(payload.baseAmount))
      const multiplier = Number(payload.multiplier)

      if (!userId) {
        return NextResponse.json({ error: "userId e obrigatorio" }, { status: 400 })
      }
      if (!(baseAmount > 0)) {
        return NextResponse.json({ error: "Valor base deve ser maior que zero" }, { status: 400 })
      }
      if (!Number.isFinite(multiplier) || multiplier <= 0) {
        return NextResponse.json({ error: "Multiplicador deve ser maior que zero" }, { status: 400 })
      }

      const rolloverRequired = round2(baseAmount * multiplier)

      // 1) Cria o deposito ancora e recupera o id gerado.
      const nowIso = new Date().toISOString()
      const { data: anchorDeposit, error: anchorError } = await supabase
        .from("deposits")
        .insert({
          user_id: userId,
          amount: baseAmount,
          currency: "BRL",
          method: "admin",
          payment_method: "admin",
          status: "completed",
          external_id: "ADMIN-ROLLOVER-" + crypto.randomUUID(),
          paid_at: nowIso,
          processed_at: nowIso,
          completed_at: nowIso,
        })
        .select("id")
        .single()

      if (anchorError || !anchorDeposit) {
        return NextResponse.json(
          { error: "Erro ao aplicar rollover: " + (anchorError?.message || "falha ao criar registro base") },
          { status: 500 },
        )
      }

      // 2) Cria a trava de rollover referenciando o deposito ancora.
      const { error: rolloverError } = await supabase.from("deposit_rollovers").insert({
        user_id: userId,
        deposit_id: anchorDeposit.id,
        deposit_amount: baseAmount,
        multiplier,
        rollover_required: rolloverRequired,
      })

      if (rolloverError) {
        // Desfaz o deposito ancora para nao deixar lixo caso a trava falhe.
        await supabase.from("deposits").delete().eq("id", anchorDeposit.id)
        return NextResponse.json({ error: "Erro ao aplicar rollover: " + rolloverError.message }, { status: 500 })
      }

      return NextResponse.json({ success: true, rolloverRequired })
    }

    if (action === "approve_kyc") {
      const kycId = payload.kycId
      const userId = payload.userId
      
      console.log("[v0] approve_kyc received:", { kycId, userId, payload })
      
      if (!kycId || !userId) {
        console.log("[v0] Missing kycId or userId")
        return NextResponse.json({ error: "kycId e userId sao obrigatorios" }, { status: 400 })
      }
      
      // Update KYC request - only update status field to avoid column errors
      const { data: kycData, error: kycError } = await supabase
        .from("kyc_requests")
        .update({ status: "approved" })
        .eq("id", kycId)
        .select()
      
      console.log("[v0] KYC update result:", { kycData, kycError })
      
      if (kycError) {
        console.log("[v0] KYC update error:", kycError)
        return NextResponse.json({ error: "Erro ao atualizar KYC: " + kycError.message }, { status: 500 })
      }
      
      // Update profile - only update is_verified to avoid column errors
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .update({ is_verified: true })
        .eq("id", userId)
        .select()
      
      console.log("[v0] Profile update result:", { profileData, profileError })
      
      if (profileError) {
        console.log("[v0] Profile update error:", profileError)
        return NextResponse.json({ error: "Erro ao atualizar perfil: " + profileError.message }, { status: 500 })
      }
      
      return NextResponse.json({ success: true })
    }

    if (action === "reject_kyc") {
      const kycId = payload.kycId
      const userId = payload.userId
      const reason = payload.reason
      
      console.log("[v0] reject_kyc received:", { kycId, userId, reason })
      
      if (!kycId || !userId) {
        return NextResponse.json({ error: "kycId e userId sao obrigatorios" }, { status: 400 })
      }
      
      // Update KYC request - only update status field to avoid column errors
      const { data: kycData, error: kycError } = await supabase
        .from("kyc_requests")
        .update({ status: "rejected" })
        .eq("id", kycId)
        .select()
      
      console.log("[v0] KYC reject result:", { kycData, kycError })
      
      if (kycError) {
        console.log("[v0] KYC reject error:", kycError)
        return NextResponse.json({ error: "Erro ao rejeitar KYC: " + kycError.message }, { status: 500 })
      }
      
      // Update profile - only set is_verified to false
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .update({ is_verified: false })
        .eq("id", userId)
        .select()
      
      console.log("[v0] Profile reject result:", { profileData, profileError })
      
      if (profileError) {
        console.log("[v0] Profile reject error:", profileError)
        return NextResponse.json({ error: "Erro ao atualizar perfil: " + profileError.message }, { status: 500 })
      }
      
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "Acao invalida" }, { status: 400 })
  } catch (error: any) {
    console.log("[v0] Admin API error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
