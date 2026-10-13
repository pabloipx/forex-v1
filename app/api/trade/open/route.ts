import { NextResponse } from "next/server"
import { getTradeManager } from "@/lib/trade-engine/trade-manager"
import { isTimeframeAllowed, timeframesFor, TIMEFRAME_LABELS } from "@/lib/trading/timeframes"

export async function POST(request: Request) {
  try {
    // Verifica se Supabase está configurado
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
      return NextResponse.json({ error: "Database not configured" }, { status: 503 })
    }

    const { createClient } = await import("@/lib/supabase/server")
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { symbol, direction, amount, timeframe } = body

    if (!symbol || !direction || !amount || !timeframe) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    if (!["CALL", "PUT"].includes(direction)) {
      return NextResponse.json({ error: "Invalid direction" }, { status: 400 })
    }

    // A duracao valida depende do ativo: mercado aberto opera em 5m/10m/15m, OTC em 1m/5m/10m.
    // A checagem tem de ficar aqui, e nao so na interface: uma chamada direta a esta rota
    // poderia abrir uma operacao de 30s num par real, cuja fonte de preco nao tem resolucao
    // para liquidar de forma justa.
    if (!isTimeframeAllowed(symbol, timeframe)) {
      const permitidos = timeframesFor(symbol)
        .map(tf => TIMEFRAME_LABELS[tf])
        .join(", ")
      return NextResponse.json(
        { error: `Tempo indisponivel para ${symbol}. Use: ${permitidos}.` },
        { status: 400 },
      )
    }

    if (amount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 })
    }

    const { data: existingTrade } = await supabase
      .from("trades")
      .select("id")
      .eq("user_id", user.id)
      .eq("result", "PENDING")
      .single()

    if (existingTrade) {
      return NextResponse.json({ error: "You already have an active trade" }, { status: 400 })
    }

    const tradeManager = getTradeManager()
    const result = await tradeManager.openTrade(user.id, symbol, direction, amount, timeframe)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      trade: result.trade,
      newBalance: result.newBalance,
    })
  } catch (error) {
    console.error("Error opening trade:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
