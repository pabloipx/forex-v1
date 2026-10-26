import "server-only"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"

export const LAUNCH_STATUSES = ["upcoming", "live", "ended"] as const

export interface TokenLaunch {
  id: string
  symbol: string
  name: string
  description: string | null
  icon_url: string | null
  website_url: string | null
  launch_at: string | null
  initial_price_usd: number | null
  total_supply: number | null
  status: (typeof LAUNCH_STATUSES)[number]
  visible: boolean
  sort_order: number
}

const COLUMNS =
  "id, symbol, name, description, icon_url, website_url, launch_at, initial_price_usd, total_supply, status, visible, sort_order"

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => !v || v.startsWith("/") || /^https:\/\//.test(v), "Use um caminho (/images/...) ou um link https")
  .nullish()

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
  initial_price_usd: z.number().finite().min(0).max(1_000_000_000).nullish(),
  total_supply: z.number().finite().min(0).max(1e18).nullish(),
  status: z.enum(LAUNCH_STATUSES),
  visible: z.boolean(),
  sort_order: z.number().int().min(0).max(9999),
})

export type LaunchInput = z.infer<typeof launchInputSchema>

const toLaunch = (row: Record<string, unknown>): TokenLaunch => ({
  ...(row as unknown as TokenLaunch),
  initial_price_usd: row.initial_price_usd == null ? null : Number(row.initial_price_usd),
  total_supply: row.total_supply == null ? null : Number(row.total_supply),
})

export async function listLaunches({ onlyVisible }: { onlyVisible: boolean }): Promise<TokenLaunch[]> {
  let query = createAdminClient().from("token_launches").select(COLUMNS)
  if (onlyVisible) query = query.eq("visible", true)
  const { data, error } = await query.order("sort_order").order("created_at")
  if (error) throw new Error(error.message)
  return (data ?? []).map(toLaunch)
}

export async function saveLaunch({ id, ...input }: LaunchInput): Promise<TokenLaunch> {
  const admin = createAdminClient()
  const payload = { ...input, updated_at: new Date().toISOString() }
  const { data, error } = id
    ? await admin.from("token_launches").update(payload).eq("id", id).select(COLUMNS).single()
    : await admin.from("token_launches").insert(payload).select(COLUMNS).single()
  if (error) throw new Error(error.code === "23505" ? "Já existe uma moeda com esse símbolo" : error.message)
  return toLaunch(data)
}

export async function deleteLaunch(id: string): Promise<void> {
  const { error } = await createAdminClient().from("token_launches").delete().eq("id", id)
  if (error) throw new Error(error.message)
}
