import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { ASSET_CATALOG } from "@/lib/asset-catalog"
import { isAdminRequest } from "@/lib/admin/session"

export const dynamic = "force-dynamic"


async function verifyAdminToken(): Promise<boolean> {
  return isAdminRequest()
}

export async function GET(request: Request) {
  try {
    if (!(await verifyAdminToken())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const adminClient = createAdminClient()
    const { data: rows, error } = await adminClient
      .from("asset_settings")
      .select("symbol, enabled, sort_order, payout")
    if (error) throw error

    const settings = new Map((rows || []).map((r: any) => [r.symbol, r]))

    const assets = ASSET_CATALOG.map((a, index) => {
      const row = settings.get(a.symbol)
      return {
        symbol: a.symbol,
        name: a.name,
        category: a.category,
        // Usa o payout definido pelo admin; se nulo, cai no padrão do catálogo.
        payout: row?.payout ?? a.payout,
        logo: a.logo,
        enabled: row ? row.enabled : true,
        sortOrder: row?.sort_order ?? index,
      }
    }).sort((a, b) => a.sortOrder - b.sortOrder)

    return NextResponse.json({ assets })
  } catch (error) {
    console.error("Error fetching assets:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    if (!(await verifyAdminToken())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { symbol, enabled, payout } = body

    if (typeof symbol !== "string") {
      return NextResponse.json({ error: "symbol é obrigatório" }, { status: 400 })
    }
    if (!ASSET_CATALOG.some((a) => a.symbol === symbol)) {
      return NextResponse.json({ error: "Ativo inválido" }, { status: 400 })
    }
    if (enabled === undefined && payout === undefined) {
      return NextResponse.json({ error: "Informe enabled ou payout" }, { status: 400 })
    }

    const update: Record<string, any> = { symbol, updated_at: new Date().toISOString() }

    if (enabled !== undefined) {
      if (typeof enabled !== "boolean") {
        return NextResponse.json({ error: "enabled inválido" }, { status: 400 })
      }
      update.enabled = enabled
    }

    if (payout !== undefined) {
      const value = Number(payout)
      if (!Number.isFinite(value) || value < 1 || value > 100) {
        return NextResponse.json({ error: "payout deve estar entre 1 e 100" }, { status: 400 })
      }
      update.payout = Math.round(value)
    }

    const adminClient = createAdminClient()
    const { error } = await adminClient.from("asset_settings").upsert(update, { onConflict: "symbol" })
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating asset:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
