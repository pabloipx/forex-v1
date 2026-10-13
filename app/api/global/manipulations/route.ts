import { NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

/**
 * Endpoint PUBLICO de sincronizacao de manipulacoes.
 *
 * O cliente (grafico) consulta este endpoint periodicamente e injeta as manipulacoes ativas
 * no motor de precos. Retornamos tambem as agendadas (start no futuro) para que o motor as
 * aplique automaticamente quando chegar a hora.
 *
 * IMPORTANTE: retornamos TODAS as manipulacoes com active = true, inclusive as ja terminadas.
 * Ao terminar, o motor CONGELA o deslocamento no nivel alcancado e o preco segue a partir dali
 * (nao volta ao normal). Esse nivel so existe enquanto a manipulacao continua na lista: se a
 * removessemos no end_time, o drift cairia para zero de uma vez e o grafico daria o salto de
 * "subir/desce de uma vez" que o usuario relatou. Quem encerra o efeito e o admin, desativando a
 * manipulacao (active = false) — e nesse momento o deslocamento sai da lista.
 * Limite de 200 protege a performance (o motor percorre esta lista por vela do historico).
 */
export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SECRET_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    if (!url || !key) return NextResponse.json({ manipulations: [] })

    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // Sem filtro por end_time: uma manipulacao ativa e terminada mantem o preco no nivel congelado.
    // As mais recentes primeiro, limitadas a 200 para nao pesar no motor.
    const { data, error } = await supabase
      .from("otc_manipulations")
      .select("symbol, direction, start_time, end_time, strength, style")
      .eq("active", true)
      .order("start_time", { ascending: false })
      .limit(200)

    if (error) return NextResponse.json({ manipulations: [] })

    const manipulations = (data || []).map((m: any) => ({
      symbol: m.symbol,
      direction: m.direction,
      startTime: Math.floor(new Date(m.start_time).getTime() / 1000),
      endTime: Math.floor(new Date(m.end_time).getTime() / 1000),
      strength: Number(m.strength) || 60,
      style: m.style || "natural",
    }))

    return NextResponse.json({ manipulations })
  } catch {
    return NextResponse.json({ manipulations: [] })
  }
}
