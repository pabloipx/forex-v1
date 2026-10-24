import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { effectiveRate, getDepositSettings, getUsdBrlRate } from "@/lib/fx"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const [quote, settings] = await Promise.all([getUsdBrlRate(), getDepositSettings(createAdminClient())])

    return NextResponse.json(
      {
        market_rate: quote.rate,
        rate: effectiveRate(quote.rate, settings.fxSpreadPercent),
        spread_percent: settings.fxSpreadPercent,
        min_deposit_usd: settings.minDepositUsd,
        max_deposit_usd: settings.maxDepositUsd,
        source: quote.source,
        updated_at: quote.updatedAt,
      },
      { headers: { "Cache-Control": "no-store" } },
    )
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cotacao indisponivel" },
      { status: 503 },
    )
  }
}
