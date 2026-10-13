export interface AffiliateInfo {
  id: string
  user_id: string
  code: string
  commission_rate: number
  commission_model?: "revshare" | "cpa" | "hybrid"
  cpa_amount?: number
  cpa_min_deposit?: number
  sub_percent?: number
  min_withdrawal?: number
  withdrawal_fee_percent?: number
  balance: number
  status: string
  total_earned: number
  total_referrals: number
  referrals_with_deposit: number
}

export interface AffiliateReferral {
  id: string
  referred_user_id: string
  status: string
  total_deposits: number
  total_commission: number
  created_at: string
  /** subID da campanha que originou a indicacao (?ref=CODE&subid=...). */
  subid?: string | null
  profiles?: {
    full_name?: string | null
    email?: string | null
  }
}

export interface AffiliateWithdrawal {
  id: string
  amount: number
  fee: number
  net_amount: number
  pix_key: string
  pix_key_type: string
  status: string
  created_at: string
}

export interface AffiliateData {
  affiliate: AffiliateInfo | null
  referrals: AffiliateReferral[]
  withdrawals: AffiliateWithdrawal[]
  display?: {
    currency: "BRL" | "USD"
    usd_rate: number
    next_payment_date: string | null
  }
}

export interface AffiliatePaymentMethod {
  id: string
  method: "usdt" | "pix"
  wallet_address: string | null
  pix_key: string | null
  pix_key_type: string | null
  is_default: boolean
  created_at: string
}

export interface AffiliateProfile {
  email: string
  email_confirmed: boolean
  account_type: string
  first_name: string
  last_name: string
  nickname: string
  country: string
  birth_date: string
}

export type AffiliateSection =
  | "stats-general"
  | "stats-clients"
  | "offers"
  | "payments"
  | "competition"
  | "sub-affiliate"
  | "postbacks"
  | "postbacks-general"
  | "postbacks-telegram"
  | "account"
  | "account-security"
  | "account-profile"

export const PAYMENT_METHOD_INFO = {
  usdt: {
    label: "USDT",
    minRegular: 250,
    minRequested: 1000,
    fee: "Nenhuma taxa",
    note: null as string | null,
  },
  pix: {
    label: "PIX",
    minRegular: 250,
    minRequested: 250,
    fee: "Nenhuma taxa",
    note: "* - A retirada máxima diária para o PIX é de $5000",
  },
} as const

export const shortDate = (value: string) =>
  new Date(value).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
