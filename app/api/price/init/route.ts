import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getPriceManager } from "@/lib/price-engine/price-manager"

/**
 * Initialize price manager with OTC symbols from database
 * This should be called once when the server starts
 */
export async function POST() {
  try {
    const supabase = await createClient()

    // Fetch active OTC symbols
    const { data: symbols, error } = await supabase.from("otc_symbols").select("*").eq("is_active", true)

    if (error) throw error

    if (!symbols || symbols.length === 0) {
      return NextResponse.json({ error: "No active OTC symbols found" }, { status: 404 })
    }

    // Initialize price manager
    const priceManager = getPriceManager()
    priceManager.initialize(symbols)
    priceManager.start()

    return NextResponse.json({
      success: true,
      message: "Price manager initialized",
      symbols: symbols.map((s) => s.symbol),
    })
  } catch (error) {
    console.error("[v0] Error initializing price manager:", error)
    return NextResponse.json({ error: "Failed to initialize price manager" }, { status: 500 })
  }
}
