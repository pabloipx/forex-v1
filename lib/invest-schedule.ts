export const INVEST_MIN = 500
export const INVEST_MONTHLY_RATE = 0.1
export const INVEST_MONTHS = 3

/** Monthly rate per asset id (0.1 = 10%), as configured by the admin. */
export type InvestRates = Record<string, number>

export const rateFor = (rates: InvestRates | undefined, asset: string) => {
  const r = rates?.[asset]
  return typeof r === "number" && Number.isFinite(r) && r > 0 ? r : INVEST_MONTHLY_RATE
}

export const INVEST_TERM_MIN = 1
export const INVEST_TERM_MAX = 24
export const INVEST_TERM_OPTIONS = [1, 2, 3, 4, 5, 6, 9, 12, 18, 24] as const

/** Term in months per asset id, as configured by the admin. */
export type InvestTerms = Record<string, number>

export const termFor = (terms: InvestTerms | undefined, asset: string) => {
  const t = terms?.[asset]
  return typeof t === "number" && Number.isInteger(t) && t >= INVEST_TERM_MIN && t <= INVEST_TERM_MAX ? t : INVEST_MONTHS
}

export const fmtTerm = (months: number) =>
  months === 12 ? "1 ano" : months === 24 ? "2 anos" : `${months} ${months === 1 ? "mês" : "meses"}`

export const fmtRate = (rate: number) =>
  `${(rate * 100).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}%`

export interface InvestmentView {
  id: string
  asset: string
  amount: number
  monthlyRate: number
  monthlyYield: number
  months: number
  startedAt: string
  payoutsDone: number
  nextPayoutAt: string | null
  unlockAt: string
  yieldPaid: number
  available: number
  status: "active" | "completed"
}

const BRT_OFFSET_MS = 3 * 60 * 60 * 1000

/** Day 30 (or the month's last day) of the k-th month after the start, at 00:00 Brasília — mirrors invest_payout_at in SQL. */
export function payoutAt(start: Date, k: number): Date {
  const brt = new Date(start.getTime() - BRT_OFFSET_MS)
  const year = brt.getUTCFullYear()
  const month = brt.getUTCMonth() + k
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  return new Date(Date.UTC(year, month, Math.min(30, lastDay)) + BRT_OFFSET_MS)
}

export const fmtUsd = (v: number) =>
  `US$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
