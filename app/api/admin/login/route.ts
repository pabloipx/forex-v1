import { createHash, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"
import {
  ADMIN_COOKIE,
  adminCookieOptions,
  createAdminSessionValue,
  getAdminCredentials,
  isAdminAuthConfigured,
} from "@/lib/admin/session"
import { clearFailures, getClientIp, getLockSeconds, registerFailure } from "@/lib/admin/login-rate-limit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Compara via hash para que o tempo nao dependa do tamanho nem do conteudo.
function secureEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest()
  const hb = createHash("sha256").update(b).digest()
  return timingSafeEqual(ha, hb)
}

// Bloqueia logins disparados por outros sites (CSRF de login).
function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin")
  if (!origin) return true
  try {
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host")
    return new URL(origin).host === host
  } catch {
    return false
  }
}

function lockedResponse(seconds: number) {
  const minutes = Math.max(1, Math.ceil(seconds / 60))
  return Response.json(
    { error: `Muitas tentativas. Tente novamente em ${minutes} min.`, success: false },
    { status: 429, headers: { "Retry-After": String(seconds) } },
  )
}

export async function POST(request: Request) {
  if (!isAdminAuthConfigured()) {
    return Response.json(
      { error: "Acesso administrativo nao configurado no servidor.", success: false },
      { status: 503 },
    )
  }

  if (!isSameOrigin(request)) {
    return Response.json({ error: "Origem nao permitida", success: false }, { status: 403 })
  }

  const ip = getClientIp(request)
  const locked = getLockSeconds(ip)
  if (locked > 0) return lockedResponse(locked)

  let email = ""
  let password = ""

  try {
    const body = await request.json()
    email = String(body?.email ?? "").slice(0, 200)
    password = String(body?.password ?? "").slice(0, 200)
  } catch {
    return Response.json({ error: "Requisicao invalida", success: false }, { status: 400 })
  }

  const { email: expectedEmail, password: expectedPassword } = getAdminCredentials()

  const emailOk = secureEqual(email.trim().toLowerCase(), expectedEmail)
  const passwordOk = secureEqual(password, expectedPassword)

  if (!emailOk || !passwordOk) {
    const lockSeconds = registerFailure(ip)
    console.warn(`[admin] login recusado ip=${ip}`)
    await delay(800)
    if (lockSeconds > 0) return lockedResponse(lockSeconds)
    return Response.json({ error: "Email ou senha incorretos", success: false }, { status: 401 })
  }

  clearFailures(ip)

  const store = await cookies()
  store.set(ADMIN_COOKIE, await createAdminSessionValue(expectedEmail), adminCookieOptions())

  return Response.json({ success: true }, { headers: { "Cache-Control": "no-store" } })
}
