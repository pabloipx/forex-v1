import { NextResponse, type NextRequest } from "next/server"
import { sweep } from "@/lib/futures/engine"
import { isSupabaseAdminConfigured } from "@/lib/supabase/env"

export const dynamic = "force-dynamic"

// Processa ordens limite, TP/SL e liquidacoes de TODAS as contas, inclusive de quem
// esta offline. Usuarios com a tela aberta ja sao processados a cada consulta de estado.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  if (!isSupabaseAdminConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 })
  }
  try {
    return NextResponse.json(await sweep())
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 })
  }
}
