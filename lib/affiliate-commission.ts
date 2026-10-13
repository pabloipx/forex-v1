import type { SupabaseClient } from "@supabase/supabase-js"

export type CommissionModel = "revshare" | "cpa" | "hybrid"

export type DisplayCurrency = "BRL" | "USD"

export interface AffiliateGlobalSettings {
  default_revshare_percent: number
  default_cpa_amount: number
  cpa_min_deposit: number
  sub_affiliate_percent: number
  min_withdrawal: number
  withdrawal_fee_percent: number
  program_enabled: boolean
  auto_approve_affiliates: boolean
  /** Moeda em que os valores sao exibidos no painel do afiliado */
  display_currency: DisplayCurrency
  /** Cotacao usada para converter BRL em USD quando display_currency = USD */
  usd_rate: number
  /** Data exata do proximo pagamento; quando nula o painel usa a janela automatica */
  next_payment_date: string | null
  updated_at: string | null
}

export const FALLBACK_SETTINGS: AffiliateGlobalSettings = {
  default_revshare_percent: 77,
  default_cpa_amount: 100,
  cpa_min_deposit: 50,
  sub_affiliate_percent: 5,
  min_withdrawal: 250,
  withdrawal_fee_percent: 2,
  program_enabled: true,
  auto_approve_affiliates: true,
  display_currency: "BRL",
  usd_rate: 5.4,
  next_payment_date: null,
  updated_at: null,
}

const num = (value: unknown, fallback: number) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

/** Carrega as configurações globais do programa, caindo para os padrões quando ausentes. */
export async function getAffiliateSettings(supabase: SupabaseClient): Promise<AffiliateGlobalSettings> {
  const { data } = await supabase.from("affiliate_global_settings").select("*").eq("id", 1).maybeSingle()

  if (!data) return FALLBACK_SETTINGS

  return {
    default_revshare_percent: num(data.default_revshare_percent, FALLBACK_SETTINGS.default_revshare_percent),
    default_cpa_amount: num(data.default_cpa_amount, FALLBACK_SETTINGS.default_cpa_amount),
    cpa_min_deposit: num(data.cpa_min_deposit, FALLBACK_SETTINGS.cpa_min_deposit),
    sub_affiliate_percent: num(data.sub_affiliate_percent, FALLBACK_SETTINGS.sub_affiliate_percent),
    min_withdrawal: num(data.min_withdrawal, FALLBACK_SETTINGS.min_withdrawal),
    withdrawal_fee_percent: num(data.withdrawal_fee_percent, FALLBACK_SETTINGS.withdrawal_fee_percent),
    program_enabled: data.program_enabled !== false,
    auto_approve_affiliates: data.auto_approve_affiliates !== false,
    display_currency: data.display_currency === "USD" ? "USD" : "BRL",
    // Uma cotacao zerada ou invalida quebraria a conversao, entao cai no padrao
    usd_rate: Math.max(num(data.usd_rate, FALLBACK_SETTINGS.usd_rate), 0.01),
    next_payment_date: data.next_payment_date ?? null,
    updated_at: data.updated_at ?? null,
  }
}

export interface AffiliateTerms {
  model: CommissionModel
  revsharePercent: number
  cpaAmount: number
  cpaMinDeposit: number
  subPercent: number
}

/** Resolve os termos efetivos de um afiliado, usando os padrões globais como fallback. */
export function resolveTerms(
  profile: {
    affiliate_commission_percent?: number | null
    affiliate_cpa_amount?: number | null
    affiliate_commission_model?: string | null
    affiliate_cpa_min_deposit?: number | null
    affiliate_sub_percent?: number | null
  },
  settings: AffiliateGlobalSettings,
): AffiliateTerms {
  const rawModel = profile.affiliate_commission_model
  const model: CommissionModel =
    rawModel === "revshare" || rawModel === "cpa" || rawModel === "hybrid" ? rawModel : "hybrid"

  return {
    model,
    revsharePercent: num(profile.affiliate_commission_percent, settings.default_revshare_percent),
    cpaAmount: num(profile.affiliate_cpa_amount, settings.default_cpa_amount),
    cpaMinDeposit: num(profile.affiliate_cpa_min_deposit, settings.cpa_min_deposit),
    subPercent: num(profile.affiliate_sub_percent, settings.sub_affiliate_percent),
  }
}

export interface CommissionBreakdown {
  total: number
  revshareAmount: number
  cpaAmount: number
  /** Modelo efetivamente aplicado neste depósito */
  appliedModel: CommissionModel
}

/**
 * Calcula a comissão gerada por um depósito.
 *
 * Apenas o CPA nasce do depósito: um valor fixo, uma única vez por indicado, quando ele faz o
 * primeiro depósito que atinge o mínimo exigido.
 *
 * O RevShare NÃO é mais calculado aqui. Antes ele era um percentual sobre o valor depositado, o
 * que pagava o afiliado igual independente de o indicado ganhar ou perder — não acompanhava o
 * resultado real da casa. Agora o RevShare é apurado sobre a receita líquida das operações, em
 * `lib/affiliate-revshare.ts`.
 *
 * - cpa: valor fixo no primeiro depósito qualificado
 * - revshare: nada no depósito (a comissão vem das operações)
 * - hybrid: CPA no primeiro depósito qualificado + RevShare das operações
 */
export function calculateCommission(
  depositAmount: number,
  terms: AffiliateTerms,
  options: { isFirstQualifiedDeposit: boolean },
): CommissionBreakdown {
  const amount = num(depositAmount, 0)
  const qualifiesForCpa = options.isFirstQualifiedDeposit && amount >= terms.cpaMinDeposit

  const cpaAmount = (terms.model === "cpa" || terms.model === "hybrid") && qualifiesForCpa ? terms.cpaAmount : 0

  return {
    total: round2(cpaAmount),
    revshareAmount: 0,
    cpaAmount: round2(cpaAmount),
    appliedModel: terms.model,
  }
}

export function round2(value: number) {
  return Math.round((Number(value) || 0) * 100) / 100
}

/**
 * Verifica se este é o primeiro depósito do referido que gera CPA.
 * Um CPA por usuário referido.
 */
export async function isFirstCpaForReferral(
  supabase: SupabaseClient,
  affiliateId: string,
  referredUserId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("affiliate_commissions")
    .select("id")
    .eq("affiliate_id", affiliateId)
    .eq("referred_user_id", referredUserId)
    .gt("cpa_amount", 0)
    .limit(1)

  return !data || data.length === 0
}
