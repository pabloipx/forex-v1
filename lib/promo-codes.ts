import type { SupabaseClient } from "@supabase/supabase-js"

/** Arredonda para 2 casas evitando erro de ponto flutuante (ex.: 0.1+0.2). */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

export type PromoCode = {
  id: string
  code: string
  description: string | null
  bonus_type: "percent" | "fixed"
  bonus_value: number
  max_bonus: number | null
  min_deposit: number
  rollover_multiplier: number
  max_uses: number | null
  uses_count: number
  max_uses_per_user: number
  is_active: boolean
  starts_at: string | null
  expires_at: string | null
}

export type UserBonus = {
  id: string
  code: string
  bonus_amount: number
  rollover_required: number
  rollover_progress: number
  status: "active" | "completed" | "cancelled"
  granted_at: string
}

export type PromoValidation =
  | {
      valid: true
      promo: PromoCode
      bonusAmount: number
      rolloverRequired: number
    }
  | { valid: false; error: string }

/**
 * Calcula o bonus de um codigo para um valor de deposito.
 *
 * Para 'percent', bonus_value e a porcentagem do deposito; para 'fixed', e o valor em reais.
 * `max_bonus` limita o resultado (usado nas campanhas de porcentagem para conter o custo).
 */
export function calculateBonus(promo: PromoCode, depositAmount: number): number {
  const raw = promo.bonus_type === "percent" ? (depositAmount * Number(promo.bonus_value)) / 100 : Number(promo.bonus_value)

  const capped = promo.max_bonus != null ? Math.min(raw, Number(promo.max_bonus)) : raw
  return round2(Math.max(0, capped))
}

/** Volume exigido para liberar o bonus. Multiplicador 0 significa bonus sem rollover. */
export function calculateRollover(promo: PromoCode, bonusAmount: number): number {
  return round2(bonusAmount * Number(promo.rollover_multiplier))
}

/** Le uma configuracao booleana de platform_settings, com valor padrao. */
async function getBooleanSetting(supabase: SupabaseClient, key: string, fallback: boolean): Promise<boolean> {
  const { data } = await supabase.from("platform_settings").select("setting_value").eq("setting_key", key).maybeSingle()

  if (!data?.setting_value) return fallback
  // setting_value e jsonb: pode voltar como boolean real ou como a string "true".
  const raw = typeof data.setting_value === "string" ? data.setting_value.replace(/"/g, "") : data.setting_value
  return raw === true || raw === "true"
}

export async function arePromoCodesEnabled(supabase: SupabaseClient): Promise<boolean> {
  return getBooleanSetting(supabase, "promo_codes_enabled", true)
}

export async function shouldCancelBonusOnWithdrawal(supabase: SupabaseClient): Promise<boolean> {
  return getBooleanSetting(supabase, "cancel_bonus_on_withdrawal", true)
}

/**
 * Valida um codigo para um usuario e valor de deposito, aplicando todas as regras da campanha.
 *
 * Usada em dois momentos: quando o usuario digita o codigo na tela de deposito (previa) e de novo
 * na hora de conceder o bonus. Revalidar no segundo momento e essencial, porque entre gerar o PIX e
 * pagar pode passar bastante tempo — a campanha pode ter expirado ou esgotado os usos nesse meio.
 */
export async function validatePromoCode(
  supabase: SupabaseClient,
  rawCode: string,
  userId: string,
  depositAmount: number,
): Promise<PromoValidation> {
  const code = (rawCode || "").trim().toUpperCase()
  if (!code) {
    return { valid: false, error: "Informe um código promocional." }
  }

  if (!(await arePromoCodesEnabled(supabase))) {
    return { valid: false, error: "Os códigos promocionais estão temporariamente desativados." }
  }

  const { data: promo } = await supabase.from("promo_codes").select("*").eq("code", code).maybeSingle()

  if (!promo) {
    return { valid: false, error: "Código promocional não encontrado." }
  }

  const p = promo as PromoCode

  if (!p.is_active) {
    return { valid: false, error: "Este código não está mais ativo." }
  }

  const now = Date.now()
  if (p.starts_at && new Date(p.starts_at).getTime() > now) {
    return { valid: false, error: "Este código ainda não está válido." }
  }
  if (p.expires_at && new Date(p.expires_at).getTime() < now) {
    return { valid: false, error: "Este código expirou." }
  }
  if (p.max_uses != null && p.uses_count >= p.max_uses) {
    return { valid: false, error: "Este código atingiu o limite de utilizações." }
  }
  if (depositAmount < Number(p.min_deposit)) {
    return {
      valid: false,
      error: `Depósito mínimo de R$ ${Number(p.min_deposit).toFixed(2)} para usar este código.`,
    }
  }

  // Quantas vezes ESTE usuario ja usou o codigo.
  const { count: userUses } = await supabase
    .from("user_bonuses")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("promo_code_id", p.id)

  if ((userUses || 0) >= p.max_uses_per_user) {
    return { valid: false, error: "Você já utilizou este código." }
  }

  // So um bonus ativo por vez: com dois em paralelo nao ha como dizer qual volume abate qual
  // rollover, e o banco tem um indice unico que bloquearia a insercao mais adiante.
  const { data: activeBonus } = await supabase
    .from("user_bonuses")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle()

  if (activeBonus) {
    return { valid: false, error: "Você já tem um bônus em andamento. Conclua o rollover para usar outro código." }
  }

  const bonusAmount = calculateBonus(p, depositAmount)
  if (bonusAmount <= 0) {
    return { valid: false, error: "Este código não gera bônus para o valor informado." }
  }

  return {
    valid: true,
    promo: p,
    bonusAmount,
    rolloverRequired: calculateRollover(p, bonusAmount),
  }
}

/**
 * Concede o bonus de um deposito aprovado: credita o valor no saldo real e cria o registro de
 * rollover.
 *
 * Chamada dentro de approveDeposit, o unico ponto de servidor por onde o deposito e creditado.
 * A protecao contra credito duplicado (webhook reenviado pelo provedor, por exemplo) e o indice
 * UNIQUE em user_bonuses.deposit_id: a segunda tentativa viola a restricao e nao credita nada.
 *
 * Nunca lanca excecao — um erro aqui nao pode impedir o deposito de ser creditado.
 */
export async function grantDepositBonus(
  supabaseAdmin: SupabaseClient,
  deposit: { id: string; user_id: string; amount: number; promo_code?: string | null },
): Promise<{ granted: boolean; bonusAmount?: number; reason?: string }> {
  try {
    if (!deposit.promo_code) {
      return { granted: false, reason: "sem codigo" }
    }

    // Revalida no momento da concessao: entre gerar o PIX e pagar, a campanha pode ter mudado.
    const validation = await validatePromoCode(supabaseAdmin, deposit.promo_code, deposit.user_id, deposit.amount)

    if (!validation.valid) {
      console.log(`[v0] Bonus nao concedido no deposito ${deposit.id}: ${validation.error}`)
      return { granted: false, reason: validation.error }
    }

    const { promo, bonusAmount, rolloverRequired } = validation

    const { error: bonusError } = await supabaseAdmin.from("user_bonuses").insert({
      user_id: deposit.user_id,
      promo_code_id: promo.id,
      deposit_id: deposit.id,
      code: promo.code,
      deposit_amount: deposit.amount,
      bonus_amount: bonusAmount,
      rollover_required: rolloverRequired,
    })

    if (bonusError) {
      // 23505 = unique_violation: este deposito ja gerou bonus. Nao e falha, e a idempotencia
      // funcionando (webhook duplicado). Sair aqui evita creditar o bonus duas vezes.
      if (bonusError.code === "23505") {
        return { granted: false, reason: "bonus ja concedido" }
      }
      throw new Error(bonusError.message)
    }

    // Credita o bonus no saldo real. O valor fica "travado" de forma logica: continua contando
    // para operar, mas get_locked_balance o subtrai do que pode ser sacado.
    const { data: balance } = await supabaseAdmin
      .from("user_balances")
      .select("balance_real")
      .eq("user_id", deposit.user_id)
      .maybeSingle()

    const newBalance = round2(Number(balance?.balance_real || 0) + bonusAmount)

    const { error: balanceError } = await supabaseAdmin
      .from("user_balances")
      .upsert(
        { user_id: deposit.user_id, balance_real: newBalance, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      )

    if (balanceError) {
      throw new Error(balanceError.message)
    }

    // A tabela `transactions` nao tem coluna `status` — as colunas reais sao balance_after,
    // account_type e reference_id. Usar campo inexistente faria o insert ser recusado inteiro.
    await supabaseAdmin.from("transactions").insert({
      user_id: deposit.user_id,
      type: "bonus",
      amount: bonusAmount,
      balance_after: newBalance,
      account_type: "real",
      reference_id: deposit.id,
      description: `Bônus do código ${promo.code}`,
    })

    // Contador de usos da campanha.
    await supabaseAdmin
      .from("promo_codes")
      .update({ uses_count: promo.uses_count + 1 })
      .eq("id", promo.id)

    console.log(`[v0] Bonus de R$ ${bonusAmount} concedido (codigo ${promo.code}, deposito ${deposit.id})`)
    return { granted: true, bonusAmount }
  } catch (error) {
    console.error("[v0] Erro ao conceder bonus:", error)
    return { granted: false, reason: "erro interno" }
  }
}

/** Bonus ativo do usuario, com o progresso do rollover. */
export async function getActiveBonus(supabase: SupabaseClient, userId: string): Promise<UserBonus | null> {
  const { data } = await supabase
    .from("user_bonuses")
    .select("id, code, bonus_amount, rollover_required, rollover_progress, status, granted_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle()

  return (data as UserBonus) || null
}

/**
 * Valor que o usuario NAO pode sacar por estar preso a um rollover em andamento.
 * Zero quando nao ha bonus ativo.
 */
export async function getLockedBalance(supabase: SupabaseClient, userId: string): Promise<number> {
  const bonus = await getActiveBonus(supabase, userId)
  return bonus ? round2(Number(bonus.bonus_amount)) : 0
}

/**
 * Cancela o bonus ativo, removendo do saldo o valor ainda travado.
 *
 * Usada quando o usuario saca antes de cumprir o rollover e a plataforma esta configurada para
 * cancelar o bonus nesse caso.
 */
export async function cancelActiveBonus(
  supabaseAdmin: SupabaseClient,
  userId: string,
  reason: string,
): Promise<{ cancelled: boolean; removedAmount?: number }> {
  const bonus = await getActiveBonus(supabaseAdmin, userId)
  if (!bonus) return { cancelled: false }

  const { data: updated, error } = await supabaseAdmin
    .from("user_bonuses")
    .update({ status: "cancelled", cancelled_at: new Date().toISOString(), cancelled_reason: reason })
    .eq("id", bonus.id)
    .eq("status", "active") // evita cancelar duas vezes em chamadas concorrentes
    .select("id")

  if (error || !updated || updated.length === 0) {
    return { cancelled: false }
  }

  const bonusAmount = round2(Number(bonus.bonus_amount))

  const { data: balance } = await supabaseAdmin
    .from("user_balances")
    .select("balance_real")
    .eq("user_id", userId)
    .maybeSingle()

  // Nunca deixa o saldo negativo: se o usuario perdeu parte do bonus operando, retiramos apenas
  // o que ainda existe.
  const current = Number(balance?.balance_real || 0)
  const removed = Math.min(bonusAmount, Math.max(0, current))

  await supabaseAdmin
    .from("user_balances")
    .update({ balance_real: round2(current - removed), updated_at: new Date().toISOString() })
    .eq("user_id", userId)

  if (removed > 0) {
    await supabaseAdmin.from("transactions").insert({
      user_id: userId,
      type: "bonus_cancelled",
      amount: -removed,
      balance_after: round2(current - removed),
      account_type: "real",
      reference_id: bonus.id,
      description: `Bônus ${bonus.code} cancelado: ${reason}`,
    })
  }

  return { cancelled: true, removedAmount: removed }
}
