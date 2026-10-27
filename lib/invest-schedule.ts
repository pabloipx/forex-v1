export const INVEST_MIN = 500
export const INVEST_MONTHLY_RATE = 0.1
export const INVEST_MONTHS = 3

export interface InvestmentView {
  id: string
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
