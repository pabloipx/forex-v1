import { cookies } from "next/headers"
import {
  ADMIN_COOKIE,
  adminCookieOptions,
  createAdminSessionValue,
  isAdminAuthConfigured,
} from "@/lib/admin/session"

export const runtime = "nodejs"

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function POST(request: Request) {
  if (!isAdminAuthConfigured()) {
    return Response.json(
      { error: "Acesso administrativo nao configurado no servidor.", success: false },
      { status: 503 },
    )
  }

  let email = ""
  let password = ""

  try {
    const body = await request.json()
    email = String(body?.email ?? "")
    password = String(body?.password ?? "")
  } catch {
    return Response.json({ error: "Requisicao invalida", success: false }, { status: 400 })
  }

  const expectedEmail = (process.env.ADMIN_EMAIL || "").trim().toLowerCase()
  const expectedPassword = process.env.ADMIN_PASSWORD || ""

  const emailOk = email.trim().toLowerCase() === expectedEmail
  const passwordOk = password === expectedPassword

  if (!emailOk || !passwordOk) {
    // Atraso fixo para desencorajar tentativas em massa e nao revelar
    // qual dos dois campos estava errado.
    await delay(600)
    return Response.json({ error: "Email ou senha incorretos", success: false }, { status: 401 })
  }

  const store = await cookies()
  store.set(ADMIN_COOKIE, await createAdminSessionValue(expectedEmail), adminCookieOptions())

  return Response.json({ success: true })
}
