import { NextResponse } from "next/server"

/**
 * Initialize system - Serverless Compatible
 * Retorna símbolos padrão se DB não disponível
 */
export async function POST() {
  try {
    // Verifica se Supabase está configurado
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

    if (!supabaseUrl || !supabaseKey) {
      // Retorna símbolos padrão se DB não está configurado
      return NextResponse.json({
        success: true,
        message: "System initialized with defaults (no DB)",
        symbols: ["OTC_EURUSD", "OTC_GBPUSD", "OTC_USDJPY"],
      })
    }

    // Importação dinâmica para evitar erro se módulos não existem
    const { createClient } = await import("@/lib/supabase/server")
    const supabase = await createClient()

    const { data: symbols, error } = await supabase
      .from("otc_symbols")
      .select("*")
      .eq("is_active", true)

    if (error || !symbols || symbols.length === 0) {
      return NextResponse.json({
        success: true,
        message: "System initialized with defaults",
        symbols: ["OTC_EURUSD", "OTC_GBPUSD", "OTC_USDJPY"],
      })
    }

    return NextResponse.json({
      success: true,
      message: "System initialized successfully",
      symbols: symbols.map((s) => s.symbol),
    })
  } catch {
    // Nunca falha - retorna defaults
    return NextResponse.json({
      success: true,
      message: "System initialized with fallback",
      symbols: ["OTC_EURUSD", "OTC_GBPUSD", "OTC_USDJPY"],
    })
  }
}

export async function GET() {
  return POST()
}
