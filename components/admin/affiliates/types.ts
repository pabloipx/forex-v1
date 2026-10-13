export // A autorizacao do painel e feita por cookie HttpOnly assinado, enviado automaticamente
// pelo navegador em requisicoes same-origin. Nenhum segredo trafega pelo bundle.
const ADMIN_TOKEN = ""

export type CommissionModel = "revshare" | "cpa" | "hybrid"

export interface AffiliateTerms {
  model: CommissionModel
  revshare_percent: number
  cpa_amount: number
  cpa_min_deposit: number
  sub_percent: number
}

export interface AdminAffiliate {
  id: string
  code: string
  name: string
  email: string
  status: string
  created_at: string
  notes: string
  terms: AffiliateTerms
  balance: number
  total_earned: number
  revshare_earned: number
  cpa_earned: number
  paid_out: number
  pending_payout: number
  referrals: number
  depositors: number
  deposit_count: number
  deposit_total: number
  trade_volume: number
  net_revenue: number
  conversion_rate: number
  avg_deposit: number
  margin: number
  last_commission_at: string | null
}

export interface AdminWithdrawal {
  id: string
  affiliate_id: string
  amount: number
  fee: number
  net_amount: number
  status: string
  pix_key: string
  pix_key_type: string
  admin_notes: string | null
  created_at: string
  processed_at: string | null
  profile: { full_name: string; email: string; affiliate_code: string } | null
}

export interface AdminCommission {
  id: string
  created_at: string
  deposit_amount: number
  commission_amount: number
  commission_percent: number
  cpa_amount: number
  commission_model: string
  affiliate_name: string
  affiliate_code: string
  referred_name: string
}

export interface AdminLog {
  id: string
  affiliate_id: string | null
  affiliate_name: string | null
  action: string
  field: string | null
  old_value: string | null
  new_value: string | null
  note: string | null
  created_at: string
}

export interface AdminSettings {
  default_revshare_percent: number
  default_cpa_amount: number
  cpa_min_deposit: number
  sub_affiliate_percent: number
  min_withdrawal: number
  withdrawal_fee_percent: number
  program_enabled: boolean
  auto_approve_affiliates: boolean
  /** Moeda exibida no painel do afiliado */
  display_currency: "BRL" | "USD"
  /** Cotacao usada para converter os valores quando a moeda e USD */
  usd_rate: number
  /** Data exata do proximo pagamento (YYYY-MM-DD); nula usa a janela automatica */
  next_payment_date: string | null
  updated_at: string | null
}

export interface AdminStats {
  totalAffiliates: number
  activeAffiliates: number
  blockedAffiliates: number
  totalReferrals: number
  totalDepositors: number
  totalDeposited: number
  totalEarned: number
  totalRevshare: number
  totalCpa: number
  totalBalance: number
  totalPaidOut: number
  pendingPayout: number
  pendingCount: number
  netRevenue: number
}

export interface AffiliateReferral {
  id: string
  name: string
  email: string
  created_at: string
  balance: number
  deposit_total: number
  deposit_count: number
  trade_count: number
  trade_volume: number
  net_revenue: number
}

export interface AffiliateDetail extends AdminAffiliate {
  referral_list: AffiliateReferral[]
  commissions: AdminCommission[]
  withdrawals: AdminWithdrawal[]
  logs: AdminLog[]
}

export const MODEL_LABEL: Record<CommissionModel, string> = {
  revshare: "RevShare",
  cpa: "CPA",
  hybrid: "Híbrido",
}

export const money = (value: number | null | undefined) =>
  `R$ ${(Number(value) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export const compact = (value: number | null | undefined) =>
  (Number(value) || 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 })

export const pct = (value: number | null | undefined) => `${(Number(value) || 0).toFixed(1)}%`

export const dateTime = (value: string | null | undefined) => {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })
}

export const dateOnly = (value: string | null | undefined) => {
  if (!value) return "—"
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return "—"
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export async function patchAffiliate(body: Record<string, unknown>) {
  const res = await fetch("/api/admin/affiliates", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", "x-admin-token": ADMIN_TOKEN },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || "Falha ao salvar")
  return json
}
