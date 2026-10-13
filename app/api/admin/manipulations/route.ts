import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { isAdminRequest } from "@/lib/admin/session"
import { OTC_ASSETS } from "@/lib/price-engine/multi-asset-engine"

const VALID_TIMEFRAMES = [60, 300, 600]
const VALID_STYLES = ["natural", "suave", "forte", "volatil"]

// Somente ativos OTC podem ser manipulados. Os ativos de mercado aberto (BTCUSD, EURUSD, ...)
// tem preco vindo do feed real: `getCurrentPrice` retorna o tick recebido e nunca passa por
// `manipulationDrift`, entao uma manipulacao neles seria gravada, apareceria como "ativa" no
// painel e nao teria absolutamente nenhum efeito. Recusar aqui evita esse falso positivo —
// sem esta validacao a API aceitava qualquer string, inclusive ativos inexistentes.
const MANIPULABLE_SYMBOLS = new Set(
  OTC_ASSETS.filter((a) => a.symbol.endsWith("_OTC")).map((a) => a.symbol),
)

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY || ""
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function checkAuth(): Promise<boolean> {
  return isAdminRequest()
}

function notConfigured() {
  return !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY
}

// GET: lista manipulacoes (ativas e agendadas primeiro, mais recentes no topo)
export async function GET(req: NextRequest) {
  if (!(await checkAuth())) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })
  if (notConfigured()) return NextResponse.json({ error: "Database not configured" }, { status: 503 })

  try {
    const supabase = getAdminClient()
    const { data, error } = await supabase
      .from("otc_manipulations")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ manipulations: data || [] })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Erro" }, { status: 500 })
  }
}

// POST: cria uma manipulacao
export async function POST(req: NextRequest) {
  if (!(await checkAuth())) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })
  if (notConfigured()) return NextResponse.json({ error: "Database not configured" }, { status: 503 })

  try {
    const body = await req.json()
    const { symbol, direction, timeframe, mode, startAt, durationCandles, strength, style } = body
    const candleStyle = VALID_STYLES.includes(style) ? style : "natural"

    if (!symbol || typeof symbol !== "string") {
      return NextResponse.json({ error: "Ativo invalido" }, { status: 400 })
    }
    if (!MANIPULABLE_SYMBOLS.has(symbol)) {
      return NextResponse.json(
        { error: "Ativo nao manipulavel: apenas ativos OTC (o preco dos demais vem do mercado real)" },
        { status: 400 },
      )
    }
    if (!["up", "down"].includes(direction)) {
      return NextResponse.json({ error: "Direcao invalida" }, { status: 400 })
    }
    const tf = Number(timeframe)
    if (!VALID_TIMEFRAMES.includes(tf)) {
      return NextResponse.json({ error: "Tempo grafico invalido" }, { status: 400 })
    }
    const candles = Math.max(1, Math.min(240, Number(durationCandles) || 1))
    const force = Math.max(1, Math.min(100, Number(strength) || 60))

    // Momento de inicio: agora ou agendado.
    let start: Date
    if (mode === "scheduled" && startAt) {
      start = new Date(startAt)
      if (isNaN(start.getTime())) {
        return NextResponse.json({ error: "Horario agendado invalido" }, { status: 400 })
      }
    } else {
      start = new Date()
    }
    const end = new Date(start.getTime() + candles * tf * 1000)

    const supabase = getAdminClient()
    const { data, error } = await supabase
      .from("otc_manipulations")
      .insert({
        symbol,
        direction,
        timeframe: tf,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        duration_candles: candles,
        strength: force,
        style: candleStyle,
        active: true,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, manipulation: data })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Erro" }, { status: 500 })
  }
}

// DELETE: para/remove uma manipulacao (?id=...). Por padrao desativa; ?hard=1 remove a linha.
export async function DELETE(req: NextRequest) {
  if (!(await checkAuth())) return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })
  if (notConfigured()) return NextResponse.json({ error: "Database not configured" }, { status: 503 })

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get("id")
    const hard = searchParams.get("hard") === "1"
    if (!id) return NextResponse.json({ error: "id obrigatorio" }, { status: 400 })

    const supabase = getAdminClient()
    if (hard) {
      const { error } = await supabase.from("otc_manipulations").delete().eq("id", id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    } else {
      const { error } = await supabase.from("otc_manipulations").update({ active: false }).eq("id", id)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Erro" }, { status: 500 })
  }
}
