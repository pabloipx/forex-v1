import { NextResponse } from "next/server"
import { isSupabaseAdminConfigured, isSupabaseConfigured } from "@/lib/supabase/env"
import { TradingError } from "./engine"

export async function requireUser() {
  if (!isSupabaseConfigured() || !isSupabaseAdminConfigured()) {
    throw new TradingError(
      "Banco de dados não configurado. Defina NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY e SUPABASE_SECRET_KEY.",
      503,
    )
  }
  const { createClient } = await import("@/lib/supabase/server")
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new TradingError("Faça login para operar", 401)
  return user
}

export function errorResponse(e: unknown) {
  if (e instanceof TradingError) {
    return NextResponse.json({ error: e.message }, { status: e.status })
  }
  console.error("[futures] erro inesperado:", e)
  return NextResponse.json({ error: "Erro interno. Tente novamente." }, { status: 500 })
}
