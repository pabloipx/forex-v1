import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"
import { toView, type InvestmentRow } from "@/lib/investments"
import type { InvestmentView } from "@/lib/invest-schedule"

interface Investor {
  user_id: string
  email: string
  full_name: string | null
}

export interface CryptoInvestorRow extends Investor {
  launch_id: string
  symbol: string
  name: string
  icon_url: string | null
  phase: "presale" | "market"
  qty: number
  invested_usd: number
  price_usd: number
  value_usd: number
  pnl_usd: number
  updated_at: string
}

export interface PassiveInvestorRow extends Investor, InvestmentView {
  received_usd: number
}

async function profilesById(ids: string[]): Promise<Map<string, Investor>> {
  const map = new Map<string, Investor>()
  if (!ids.length) return map
  const { data, error } = await createAdminClient().from("profiles").select("id, email, full_name").in("id", ids)
  if (error) throw new Error(error.message)
  for (const p of data ?? []) {
    map.set(p.id as string, { user_id: p.id as string, email: (p.email as string) ?? "—", full_name: (p.full_name as string) ?? null })
  }
  return map
}

const fallbackInvestor = (id: string): Investor => ({ user_id: id, email: "—", full_name: null })

export async function listCryptoInvestors(): Promise<CryptoInvestorRow[]> {
  const db = createAdminClient()
  const { data: holdings, error } = await db
    .from("token_holdings")
    .select("user_id, launch_id, qty, invested_usd, updated_at, launch:token_launches(symbol, name, icon_url, status, launch_at, price_usd, presale_price_usd, initial_price_usd)")
    .gt("qty", 0)
    .order("updated_at", { ascending: false })
  if (error) throw new Error(error.message)

  const profiles = await profilesById([...new Set((holdings ?? []).map((h) => h.user_id as string))])
  const now = Date.now()

  return (holdings ?? []).flatMap((h) => {
    const l = (Array.isArray(h.launch) ? h.launch[0] : h.launch) as Record<string, unknown> | null
    if (!l) return []
    const presale = l.status === "upcoming" && (!l.launch_at || new Date(l.launch_at as string).getTime() > now)
    const price = Number(presale ? (l.presale_price_usd ?? l.initial_price_usd) : (l.price_usd ?? l.initial_price_usd)) || 0
    const qty = Number(h.qty)
    const invested = Number(h.invested_usd)
    const value = Math.round(qty * price * 100) / 100
    return [
      {
        ...(profiles.get(h.user_id as string) ?? fallbackInvestor(h.user_id as string)),
        launch_id: h.launch_id as string,
        symbol: String(l.symbol).replace(/USDT$/, ""),
        name: l.name as string,
        icon_url: (l.icon_url as string) ?? null,
        phase: presale ? "presale" : "market",
        qty,
        invested_usd: invested,
        price_usd: price,
        value_usd: value,
        pnl_usd: Math.round((value - invested) * 100) / 100,
        updated_at: h.updated_at as string,
      } satisfies CryptoInvestorRow,
    ]
  })
}

export async function listPassiveInvestors(): Promise<PassiveInvestorRow[]> {
  const { data, error } = await createAdminClient()
    .from("investments")
    .select("id, user_id, asset, amount_usd, monthly_rate, months, started_at, yield_paid_usd, principal_returned, status")
    .order("created_at", { ascending: false })
    .limit(2000)
  if (error) throw new Error(error.message)

  const rows = (data ?? []) as (InvestmentRow & { user_id: string })[]
  const profiles = await profilesById([...new Set(rows.map((r) => r.user_id))])

  return rows.map((r) => {
    const view = toView(r)
    return {
      ...(profiles.get(r.user_id) ?? fallbackInvestor(r.user_id)),
      ...view,
      received_usd: Number(r.yield_paid_usd) + (r.principal_returned ? view.amount : 0),
    }
  })
}
