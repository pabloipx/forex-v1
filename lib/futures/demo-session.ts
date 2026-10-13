import "server-only"
import { createHmac, timingSafeEqual } from "node:crypto"
import { isSupabaseAdminConfigured } from "@/lib/supabase/env"

// Login de teste usado enquanto o banco de dados não está configurado.
// Assim que NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY existirem, este modo é desativado
// automaticamente e só o login real do Supabase funciona.
export const TEST_EMAIL = "demo@localhost"
export const TEST_USER_ID = "00000000-0000-4000-8000-000000000001"
export const TEST_SESSION_COOKIE = "fx_test_session"
export const TEST_SESSION_MAX_AGE = 60 * 60 * 24 * 7

const secret = () => process.env.TEST_SESSION_SECRET || "fx-test-mode-local-secret"

export function isTestModeEnabled() {
  return !isSupabaseAdminConfigured() && process.env.NODE_ENV !== "production"
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url")
}

export function createTestSessionToken() {
  const payload = Buffer.from(
    JSON.stringify({ sub: TEST_USER_ID, exp: Date.now() + TEST_SESSION_MAX_AGE * 1000 }),
  ).toString("base64url")
  return `${payload}.${sign(payload)}`
}

export function verifyTestSessionToken(token: string | undefined): boolean {
  if (!token || !isTestModeEnabled()) return false
  const [payload, signature] = token.split(".")
  if (!payload || !signature) return false
  const expected = Buffer.from(sign(payload))
  const received = Buffer.from(signature)
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return false
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as { sub: string; exp: number }
    return data.sub === TEST_USER_ID && data.exp > Date.now()
  } catch {
    return false
  }
}
