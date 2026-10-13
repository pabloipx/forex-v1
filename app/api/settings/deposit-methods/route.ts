import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"

const CRYPTO_WALLET = "0x4a46afb8Cd04C21FD1370ECbdC1C543352e55e60"
const CRYPTO_MIN_USD = 20

export async function GET() {
  try {
    const adminClient = createAdminClient()
    const { data: settings } = await adminClient
      .from("platform_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["card_deposit_enabled", "pix_deposit_enabled", "crypto_deposit_enabled"])

    const result = {
      card_enabled: true,
      pix_enabled: true,
      crypto_enabled: false,
      crypto_wallet: CRYPTO_WALLET,
      crypto_min_usd: CRYPTO_MIN_USD,
    }

    for (const s of settings || []) {
      if (s.setting_key === "card_deposit_enabled") {
        result.card_enabled = s.setting_value === "true"
      }
      if (s.setting_key === "pix_deposit_enabled") {
        result.pix_enabled = s.setting_value === "true"
      }
      if (s.setting_key === "crypto_deposit_enabled") {
        result.crypto_enabled = s.setting_value === "true"
      }
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error("Error fetching deposit methods:", error)
    return NextResponse.json({
      card_enabled: true,
      pix_enabled: true,
      crypto_enabled: false,
      crypto_wallet: CRYPTO_WALLET,
      crypto_min_usd: CRYPTO_MIN_USD,
    })
  }
}
