import "server-only"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { TradingError } from "@/lib/futures/errors"

export const LAUNCH_STATUSES = ["upcoming", "live", "ended"] as const

export type LaunchPhase = "presale" | "live" | "ended"

export interface TokenLaunch {
  id: string
  symbol: string
  name: string
  description: string | null
  icon_url: string | null
  website_url: string | null
  launch_at: string | null
  initial_price_usd: number | null
  presale_price_usd: number | null
  price_usd: number | null
  price_updated_at: string | null
  total_supply: number | null
  status: (typeof LAUNCH_STATUSES)[number]
  visible: boolean
  sort_order: number
  phase: LaunchPhase
  trade_price_usd: number | null
}

const COLUMNS =
  "id, symbol, name, description, icon_url, website_url, launch_at, initial_price_usd, presale_price_usd, price_usd, price_updated_at, total_supply, status, visible, sort_order"

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => !v || v.startsWith("/") || /^https:\/\//.test(v), "Use um caminho (/images/...) ou um link https")
  .nullish()

const price = z.number().finite().min(0).max(1_000_000_000).nullish()

export const launchInputSchema = z.object({
  id: z.string().uuid().optional(),
  symbol: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,20}$/, "Símbolo deve ter de 2 a 20 letras ou números"),
  name: z.string().trim().min(2, "Informe o nome").max(60),
  description: z.string().trim().max(600).nullish(),
  icon_url: optionalUrl,
  website_url: optionalUrl,
  launch_at: z.string().datetime({ offset: true }).nullish(),
  initial_price_usd: price,
  presale_price_usd: price,
  price_usd: price,
  total_supply: z.number().finite().min(0).max(1e18).nullish(),
  status: z.enum(LAUNCH_STATUSES),
  visible: z.boolean(),
  sort_order: z.number().int().min(0).max(9999),
})

export type LaunchInput = z.infer<typeof launchInputSchema>

const n = (v: unknown) => (v == null ? null : Number(v))

function phaseOf(status: TokenLaunch["status"], launchAt: string | null): LaunchPhase {
  if (status === "ended") return "ended"
  if (status === "live") return "live"
  return launchAt && new Date(launchAt).getTime() <= Date.now() ? "live" : "presale"
}

const toLaunch = (row: Record<string, unknown>): TokenLaunch => {
  const base = row as unknown as TokenLaunch
  const l = {
    ...base,
    initial_price_usd: n(row.initial_price_usd),
    presale_price_usd: n(row.presale_price_usd),
    price_usd: n(row.price_usd),
    total_supply: n(row.total_supply),
  }
  const phase = phaseOf(l.status, l.launch_at)
  const trade_price_usd =
    phase === "presale" ? (l.presale_price_usd ?? l.initial_price_usd) : (l.price_usd ?? l.initial_price_usd)
  return { ...l, phase, trade_price_usd }
}

export async function listLaunches({ onlyVisible }: { onlyVisible: boolean }): Promise<TokenLaunch[]> {
  let query = createAdminClient().from("token_launches").select(COLUMNS)
  if (onlyVisible) query = query.eq("visible", true).neq("status", "ended")
  const { data, error } = await query.order("sort_order").order("created_at")
  if (error) throw new Error(error.message)
  return (data ?? []).map(toLaunch)
}

export async function saveLaunch({ id, ...input }: LaunchInput): Promise<TokenLaunch> {
  const admin = createAdminClient()
  const payload = { ...input, updated_at: new Date().toISOString(), price_updated_at: new Date().toISOString() }
  const { data, error } = id
    ? await admin.from("token_launches").update(payload).eq("id", id).select(COLUMNS).single()
    : await admin.from("token_launches").insert(payload).select(COLUMNS).single()
  if (error) throw new Error(error.code === "23505" ? "Já existe uma moeda com esse símbolo" : error.message)
  return toLaunch(data)
}

export async function setLaunchPrice(id: string, priceUsd: number): Promise<TokenLaunch> {
  const now = new Date().toISOString()
  const { data, error } = await createAdminClient()
    .from("token_launches")
    .update({ price_usd: priceUsd, price_updated_at: now, updated_at: now })
    .eq("id", id)
    .select(COLUMNS)
    .single()
  if (error) throw new Error(error.message)
  return toLaunch(data)
}

export async function setLaunchListed(id: string, listed: boolean): Promise<TokenLaunch> {
  const { data, error } = await createAdminClient()
    .from("token_launches")
    .update({ visible: listed, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(COLUMNS)
    .single()
  if (error) throw new Error(error.message)
  return toLaunch(data)
}

/** Deletes the coin and refunds every holder what they paid. Returns how many holders were refunded. */
export async function deleteLaunch(id: string): Promise<number> {
  const { data, error } = await createAdminClient().rpc("launch_delete_refund", { p_launch: id })
  if (error) throw new Error(error.message)
  return Number(data ?? 0)
}

export interface LaunchHolding {
  launch_id: string
  qty: number
  invested_usd: number
}

export async function getHoldings(userId: string): Promise<LaunchHolding[]> {
  const { data, error } = await createAdminClient()
    .from("token_holdings")
    .select("launch_id, qty, invested_usd")
    .eq("user_id", userId)
    .gt("qty", 0)
  if (error) throw new Error(error.message)
  return (data ?? []).map((h) => ({ launch_id: h.launch_id, qty: Number(h.qty), invested_usd: Number(h.invested_usd) }))
}

export interface LaunchHolderSummary {
  launch_id: string
  holders: number
  qty: number
  invested_usd: number
}

export async function getHolderSummary(): Promise<LaunchHolderSummary[]> {
  const { data, error } = await createAdminClient().from("token_holdings").select("launch_id, qty, invested_usd").gt("qty", 0)
  if (error) throw new Error(error.message)
  const map = new Map<string, LaunchHolderSummary>()
  for (const h of data ?? []) {
    const s = map.get(h.launch_id) ?? { launch_id: h.launch_id, holders: 0, qty: 0, invested_usd: 0 }
    s.holders += 1
    s.qty += Number(h.qty)
    s.invested_usd += Number(h.invested_usd)
    map.set(h.launch_id, s)
  }
  return [...map.values()]
}

export const tradeInputSchema = z.object({
  launch_id: z.string().uuid(),
  side: z.enum(["buy", "sell"]),
  /** USD amount for buys, coin quantity for sells. */
  value: z.number().finite().positive().max(1e12),
})

export async function tradeLaunch(userId: string, input: z.infer<typeof tradeInputSchema>) {
  const { data, error } = await createAdminClient().rpc("launch_trade", {
    p_user: userId,
    p_launch: input.launch_id,
    p_side: input.side,
    p_value: input.value,
  })
  if (error) {
    if (error.code === "P0001") throw new TradingError(error.message, 400)
    throw new Error(error.message)
  }
  return data as { qty: number; price: number; amount: number; holding: number; balance: number }
}
