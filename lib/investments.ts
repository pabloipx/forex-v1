import "server-only"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { TradingError } from "@/lib/futures/errors"
import { payoutAt, type InvestmentView } from "@/lib/invest-schedule"
import { INVEST_ASSET_IDS } from "@/lib/invest-assets"

export const createInvestmentSchema = z.object({
  amount: z.number().finite().min(500, "Valor mínimo para investir: US$ 500").max(1e9),
  asset: z.enum(INVEST_ASSET_IDS).default("USD"),
})

export const withdrawInvestmentSchema = z.object({ id: z.string().uuid() })

export interface InvestmentRow {
  id: string
  asset: string | null
  amount_usd: number
  monthly_rate: number
  months: number
  started_at: string
  yield_paid_usd: number
  principal_returned: boolean
  status: "active" | "completed"
}

export function toView(row: InvestmentRow, now = Date.now()): InvestmentView {
  const amount = Number(row.amount_usd)
  const monthly = Math.round(amount * Number(row.monthly_rate) * 100) / 100
  const start = new Date(row.started_at)
  const dates = Array.from({ length: row.months }, (_, k) => payoutAt(start, k + 1))
  const due = dates.filter((d) => d.getTime() <= now).length
  const yieldAvailable = Math.max(0, monthly * due - Number(row.yield_paid_usd))
  const principalAvailable = due >= row.months && !row.principal_returned ? amount : 0
  return {
    id: row.id,
    asset: row.asset ?? "USD",
    amount,
    monthlyRate: Number(row.monthly_rate),
    monthlyYield: monthly,
    months: row.months,
    startedAt: row.started_at,
    payoutsDone: due,
    nextPayoutAt: due < row.months ? dates[due].toISOString() : null,
    unlockAt: dates[row.months - 1].toISOString(),
    yieldPaid: Number(row.yield_paid_usd),
    available: Math.round((yieldAvailable + principalAvailable) * 100) / 100,
    status: row.status,
  }
}

export async function listInvestments(userId: string): Promise<InvestmentView[]> {
  const { data, error } = await createAdminClient()
    .from("investments")
    .select("id, asset, amount_usd, monthly_rate, months, started_at, yield_paid_usd, principal_returned, status")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
  if (error) throw new Error(error.message)
  return (data as InvestmentRow[]).map((r) => toView(r))
}

async function callRpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await createAdminClient().rpc(fn, args)
  if (error) {
    if (error.code === "P0001") throw new TradingError(error.message, 400)
    throw new Error(error.message)
  }
  return data as T
}

export function createInvestment(userId: string, amount: number, asset: string) {
  return callRpc<{ id: string; amount: number; asset: string; balance: number }>("invest_create", {
    p_user: userId,
    p_amount: amount,
    p_asset: asset,
  })
}

export function withdrawInvestment(userId: string, id: string) {
  return callRpc<{ yield: number; principal: number; total: number; balance: number }>("invest_withdraw", {
    p_user: userId,
    p_id: id,
  })
}
