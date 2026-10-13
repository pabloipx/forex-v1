import { NextResponse, type NextRequest } from "next/server"
import {
  TEST_SESSION_COOKIE,
  TEST_SESSION_MAX_AGE,
  checkTestCredentials,
  createTestSessionToken,
  isTestModeEnabled,
} from "@/lib/futures/demo-session"

export async function POST(request: NextRequest) {
  if (!isTestModeEnabled()) {
    return NextResponse.json({ error: "Login de teste desativado: banco de dados configurado" }, { status: 403 })
  }
  const body = (await request.json().catch(() => null)) as { email?: string; password?: string } | null
  if (!body?.email || !body?.password || !checkTestCredentials(body.email, body.password)) {
    return NextResponse.json({ error: "E-mail ou senha incorretos" }, { status: 401 })
  }
  const res = NextResponse.json({ success: true })
  res.cookies.set(TEST_SESSION_COOKIE, createTestSessionToken(), {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
    maxAge: TEST_SESSION_MAX_AGE,
  })
  return res
}

export async function DELETE() {
  const res = NextResponse.json({ success: true })
  res.cookies.set(TEST_SESSION_COOKIE, "", { httpOnly: true, secure: true, sameSite: "none", path: "/", maxAge: 0 })
  return res
}
