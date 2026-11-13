import "server-only"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { INVEST_ASSET_IDS, type InvestAssetId } from "@/lib/invest-assets"
import { INVEST_MONTHLY_RATE, type InvestRates } from "@/lib/invest-schedule"

export interface InvestRateRow {
  asset: InvestAssetId
  monthly_rate: number
  updated_at: string | null
}

/** Percent values (10 = 10% a.m.), keyed by asset. */
export const investRatesInputSchema = z
  .record(z.enum(INVEST_ASSET_IDS), z.number().finite().min(0.01, "Taxa mínima: 0,01%").max(100, "Taxa máxima: 100%"))
  .refine((r) => Object.keys(r).length > 0, "Nenhuma taxa informada")

export async function listInvestRates(): Promise<InvestRateRow[]> {
  const { data, error } = await createAdminClient().from("invest_rates").select("asset, monthly_rate, updated_at")
  if (error) throw new Error(error.message)
  const byAsset = new Map((data ?? []).map((r) => [r.asset as string, r]))
  return INVEST_ASSET_IDS.map((asset) => {
    const row = byAsset.get(asset)
    return {
      asset,
      monthly_rate: row ? Number(row.monthly_rate) : INVEST_MONTHLY_RATE,
      updated_at: row?.updated_at ?? null,
    }
  })
}

export async function getInvestRates(): Promise<InvestRates> {
  const rows = await listInvestRates()
  return Object.fromEntries(rows.map((r) => [r.asset, r.monthly_rate]))
}

export async function saveInvestRates(percentByAsset: Partial<Record<InvestAssetId, number>>) {
  const now = new Date().toISOString()
  const rows = Object.entries(percentByAsset).map(([asset, pct]) => ({
    asset,
    monthly_rate: Math.round(Number(pct) * 100) / 10000,
    updated_at: now,
  }))
  const { error } = await createAdminClient().from("invest_rates").upsert(rows, { onConflict: "asset" })
  if (error) throw new Error(error.message)
  return listInvestRates()
}
