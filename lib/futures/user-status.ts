import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"
import { TradingError } from "./errors"
import { isTestModeEnabled } from "./demo-session"

const g = globalThis as unknown as { __fxTestBlocked?: boolean }

/** Contas bloqueadas pelo admin só podem reduzir/fechar posições. */
export async function assertCanOpen(userId: string) {
  if (isTestModeEnabled()) {
    if (g.__fxTestBlocked) throw new TradingError("Conta bloqueada pelo administrador. Só é possível fechar posições.", 403)
    return
  }
  const { data } = await createAdminClient().from("profiles").select("is_blocked").eq("id", userId).maybeSingle()
  if (data?.is_blocked) throw new TradingError("Conta bloqueada pelo administrador. Só é possível fechar posições.", 403)
}
