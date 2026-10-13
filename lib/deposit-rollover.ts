import type { SupabaseClient } from "@supabase/supabase-js"
import { round2 } from "@/lib/promo-codes"

export type DepositRollover = {
  id: string
  deposit_id: string
  deposit_amount: number
  multiplier: number
  rollover_required: number
  rollover_progress: number
  status: "active" | "completed" | "cancelled"
  granted_at: string
}

export type DepositRolloverConfig = {
  enabled: boolean
  multiplier: number
}

/** Prazo padrao de processamento de saque, usado quando a configuracao nao existe no banco. */
export const DEFAULT_WITHDRAWAL_HOURS = 72

/**
 * `setting_value` e jsonb: o mesmo valor pode voltar como boolean/number real ou como string
 * (`"true"`, `"2"`), dependendo de como foi gravado. Normalizamos antes de converter.
 */
function unwrapSettingValue(value: unknown): string {
  if (value == null) return ""
  if (typeof value === "string") return value.replace(/"/g, "").trim()
  return String(value)
}

/**
 * Configuracao do rollover de deposito definida pelo admin.
 *
 * Falha de leitura devolve o rollover desativado: e o comportamento seguro, porque travar saldo
 * do usuario por engano (banco fora do ar, por exemplo) e pior do que nao travar.
 */
export async function getDepositRolloverConfig(supabase: SupabaseClient): Promise<DepositRolloverConfig> {
  const { data } = await supabase
    .from("platform_settings")
    .select("setting_key, setting_value")
    .in("setting_key", ["deposit_rollover_enabled", "deposit_rollover_multiplier"])

  const map = new Map((data || []).map((row) => [row.setting_key, unwrapSettingValue(row.setting_value)]))

  const multiplier = Number(map.get("deposit_rollover_multiplier"))

  return {
    enabled: map.get("deposit_rollover_enabled") === "true",
    multiplier: Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1,
  }
}

/** Prazo de processamento de saque exibido ao usuario (em horas). */
export async function getWithdrawalProcessingHours(supabase: SupabaseClient): Promise<number> {
  const { data } = await supabase
    .from("platform_settings")
    .select("setting_value")
    .eq("setting_key", "withdrawal_processing_hours")
    .maybeSingle()

  const hours = Number(unwrapSettingValue(data?.setting_value))
  return Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_WITHDRAWAL_HOURS
}

/**
 * Cria a trava de rollover de um deposito aprovado.
 *
 * Chamada dentro de approveDeposit, unico ponto de servidor por onde o deposito e creditado.
 * O multiplicador e congelado na linha: mudar a configuracao depois nao altera depositos
 * anteriores, para nao mudar a regra no meio do jogo para quem ja depositou.
 *
 * Nao credita nem move saldo — o valor depositado continua no saldo real e disponivel para
 * operar; a trava e logica e aplicada apenas no saque, via get_locked_balance.
 *
 * Nunca lanca excecao: uma falha aqui nao pode impedir o deposito de ser creditado.
 */
export async function grantDepositRollover(
  supabaseAdmin: SupabaseClient,
  deposit: { id: string; user_id: string; amount: number },
): Promise<{ granted: boolean; rolloverRequired?: number; reason?: string }> {
  try {
    const { enabled, multiplier } = await getDepositRolloverConfig(supabaseAdmin)

    if (!enabled) {
      return { granted: false, reason: "rollover de deposito desativado" }
    }

    const depositAmount = round2(Number(deposit.amount))
    if (!(depositAmount > 0)) {
      return { granted: false, reason: "valor invalido" }
    }

    const rolloverRequired = round2(depositAmount * multiplier)

    const { error } = await supabaseAdmin.from("deposit_rollovers").insert({
      user_id: deposit.user_id,
      deposit_id: deposit.id,
      deposit_amount: depositAmount,
      multiplier,
      rollover_required: rolloverRequired,
    })

    if (error) {
      // 23505 = unique_violation em deposit_id: webhook reenviado. A idempotencia funcionando.
      if (error.code === "23505") {
        return { granted: false, reason: "rollover ja criado" }
      }
      throw new Error(error.message)
    }

    console.log(
      `[v0] Rollover de deposito criado: R$ ${depositAmount} x${multiplier} = R$ ${rolloverRequired} (deposito ${deposit.id})`,
    )
    return { granted: true, rolloverRequired }
  } catch (error) {
    console.error("[v0] Erro ao criar rollover de deposito:", error)
    return { granted: false, reason: "erro interno" }
  }
}

/** Travas de deposito ainda em andamento, da mais antiga para a mais recente. */
export async function getActiveDepositRollovers(
  supabase: SupabaseClient,
  userId: string,
): Promise<DepositRollover[]> {
  const { data } = await supabase
    .from("deposit_rollovers")
    .select("id, deposit_id, deposit_amount, multiplier, rollover_required, rollover_progress, status, granted_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("granted_at", { ascending: true })

  return (data as DepositRollover[]) || []
}

/**
 * Resumo consolidado das travas de deposito, no formato usado pela tela de saque.
 * Soma o exigido e o negociado de todas as travas ativas.
 */
export async function getDepositRolloverSummary(
  supabase: SupabaseClient,
  userId: string,
): Promise<{
  locked: number
  required: number
  progress: number
  remaining: number
  count: number
} | null> {
  const rollovers = await getActiveDepositRollovers(supabase, userId)
  if (rollovers.length === 0) return null

  const locked = round2(rollovers.reduce((sum, r) => sum + Number(r.deposit_amount), 0))
  const required = round2(rollovers.reduce((sum, r) => sum + Number(r.rollover_required), 0))
  const progress = round2(rollovers.reduce((sum, r) => sum + Number(r.rollover_progress), 0))

  return {
    locked,
    required,
    progress,
    remaining: round2(Math.max(0, required - progress)),
    count: rollovers.length,
  }
}
