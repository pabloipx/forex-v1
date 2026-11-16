import "server-only"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { INVEST_ASSET_IDS, type InvestAssetId } from "@/lib/invest-assets"
import {
  INVEST_MONTHLY_RATE,
  INVEST_MONTHS,
  INVEST_TERM_MAX,
  INVEST_TERM_MIN,
  type InvestRates,
  type InvestTerms,
} from "@/lib/invest-schedule"

export interface InvestRateRow {
  asset: InvestAssetId
  monthly_rate: number
  term_months: number
  updated_at: string | null
}

/** Percent values (10 = 10% a.m.), keyed by asset. */
export const investRatesInputSchema = z
  .record(z.enum(INVEST_ASSET_IDS), z.number().finite().min(0.01, "Taxa mínima: 0,01%").max(100, "Taxa máxima: 100%"))
  .refine((r) => Object.keys(r).length > 0, "Nenhuma taxa informada")

/** Term in whole months, keyed by asset. */
export const investTermsInputSchema = z
  .record(
    z.enum(INVEST_ASSET_IDS),
    z
      .number()
      .int("Prazo deve ser em meses inteiros")
      .min(INVEST_TERM_MIN, `Prazo mínimo: ${INVEST_TERM_MIN} mês`)
      .max(INVEST_TERM_MAX, `Prazo máximo: ${INVEST_TERM_MAX} meses`),
  )
  .refine((r) => Object.keys(r).length > 0, "Nenhum prazo informado")

export async function listInvestRates(): Promise<InvestRateRow[]> {
  const { data, error } = await createAdminClient()
    .from("invest_rates")
    .select("asset, monthly_rate, term_months, updated_at")
  if (error) throw new Error(error.message)
  const byAsset = new Map((data ?? []).map((r) => [r.asset as string, r]))
  return INVEST_ASSET_IDS.map((asset) => {
    const row = byAsset.get(asset)
    return {
      asset,
      monthly_rate: row ? Number(row.monthly_rate) : INVEST_MONTHLY_RATE,
      term_months: row ? Number(row.term_months) : INVEST_MONTHS,
      updated_at: row?.updated_at ?? null,
    }
  })
}

export async function getInvestConfig(): Promise<{ rates: InvestRates; terms: InvestTerms }> {
  const rows = await listInvestRates()
  return {
    rates: Object.fromEntries(rows.map((r) => [r.asset, r.monthly_rate])),
    terms: Object.fromEntries(rows.map((r) => [r.asset, r.term_months])),
  }
}

export async function saveInvestConfig(
  percentByAsset: Partial<Record<InvestAssetId, number>> = {},
  termsByAsset: Partial<Record<InvestAssetId, number>> = {},
) {
  const current = new Map((await listInvestRates()).map((r) => [r.asset, r]))
  const now = new Date().toISOString()
  const assets = new Set([...Object.keys(percentByAsset), ...Object.keys(termsByAsset)] as InvestAssetId[])
  // Upsert full rows so a rate-only or term-only change never resets the other column.
  const rows = [...assets].map((asset) => {
    const cur = current.get(asset)
    const pct = percentByAsset[asset]
    return {
      asset,
      monthly_rate: pct !== undefined ? Math.round(Number(pct) * 100) / 10000 : (cur?.monthly_rate ?? INVEST_MONTHLY_RATE),
      term_months: termsByAsset[asset] ?? cur?.term_months ?? INVEST_MONTHS,
      updated_at: now,
    }
  })
  if (rows.length) {
    const { error } = await createAdminClient().from("invest_rates").upsert(rows, { onConflict: "asset" })
    if (error) throw new Error(error.message)
  }
  return listInvestRates()
}
