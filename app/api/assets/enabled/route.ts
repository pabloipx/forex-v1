import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { ASSET_CATALOG } from "@/lib/asset-catalog"

export const dynamic = "force-dynamic"

/** Lista pública dos ativos habilitados, usada pela tela de trade. */
export async function GET() {
  try {
    const adminClient = createAdminClient()
    const { data: rows, error } = await adminClient
      .from("asset_settings")
      .select("symbol, enabled, sort_order, payout")
    if (error) throw error

    const settings = new Map((rows || []).map((r: any) => [r.symbol, r]))

    const assets = ASSET_CATALOG.map((a, index) => ({
      symbol: a.symbol,
      name: a.name,
      category: a.category,
      // Payout definido pelo admin tem prioridade sobre o padrão do catálogo.
      payout: settings.get(a.symbol)?.payout ?? a.payout,
      logo: a.logo,
      market: a.market,
      sortOrder: settings.get(a.symbol)?.sort_order ?? index,
    }))
      .filter((a) => {
        const row = settings.get(a.symbol)
        return row ? row.enabled : true
      })
      .sort((a, b) => a.sortOrder - b.sortOrder)

    return NextResponse.json({ assets })
  } catch (error) {
    console.error("Error fetching enabled assets:", error)
    // Fallback: catálogo completo para não quebrar a tela de trade
    return NextResponse.json({
      assets: ASSET_CATALOG.map((a) => ({
        symbol: a.symbol,
        name: a.name,
        category: a.category,
        payout: a.payout,
        logo: a.logo,
        market: a.market,
      })),
    })
  }
}
