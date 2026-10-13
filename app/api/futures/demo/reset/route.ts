import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { errorResponse, requireUser } from "@/lib/futures/http"
import { TradingError } from "@/lib/futures/errors"

export async function POST() {
  try {
    const user = await requireUser()
    const { data, error } = await createAdminClient().rpc("reset_demo_account", { p_user: user.id })
    if (error) throw new TradingError("Não foi possível resetar a conta demo", 500)
    return NextResponse.json({ balance: String(data) })
  } catch (e) {
    return errorResponse(e)
  }
}
