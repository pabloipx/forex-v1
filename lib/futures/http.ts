import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { isSupabaseAdminConfigured, isSupabaseConfigured } from "@/lib/supabase/env"
import { TradingError } from "./errors"
import { TEST_EMAIL, TEST_SESSION_COOKIE, TEST_USER_ID, verifyTestSessionToken } from "./demo-session"

export async function requireUser(): Promise<{ id: string; email?: string }> {
  if (!isSupabaseConfigured() || !isSupabaseAdminConfigured()) {
    const cookieStore = await cookies()
    if (verifyTestSessionToken(cookieStore.get(TEST_SESSION_COOKIE)?.value)) {
      return { id: TEST_USER_ID, email: TEST_EMAIL }
    }
    throw new TradingError("Faça login para operar", 401)
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
