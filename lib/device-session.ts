import { createClient } from "@/lib/supabase/client"

const DEVICE_KEY = "kdx_device_id"

/** Gera (ou recupera) um identificador estável para este navegador/dispositivo. */
export function getDeviceId(): string {
  if (typeof window === "undefined") return ""
  let id = localStorage.getItem(DEVICE_KEY)
  if (!id) {
    id =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `dev_${Date.now()}_${Math.random().toString(36).slice(2)}`
    localStorage.setItem(DEVICE_KEY, id)
  }
  return id
}

/** Extrai navegador e sistema operacional a partir do user agent. */
export function parseUserAgent(ua: string): { browser: string; os: string; deviceName: string } {
  let browser = "Navegador"
  if (/Edg\//i.test(ua)) browser = "Microsoft Edge"
  else if (/OPR\/|Opera/i.test(ua)) browser = "Opera"
  else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = "Google Chrome"
  else if (/Firefox\//i.test(ua)) browser = "Firefox"
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari"

  let os = "Desconhecido"
  if (/Windows NT/i.test(ua)) os = "Windows"
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS"
  else if (/Mac OS X/i.test(ua)) os = "macOS"
  else if (/Android/i.test(ua)) os = "Android"
  else if (/Linux/i.test(ua)) os = "Linux"

  const isMobile = /iPhone|iPad|iPod|Android/i.test(ua)
  const deviceName = `${isMobile ? "Celular" : "Computador"} · ${os}`
  return { browser, os, deviceName }
}

/**
 * Registra (ou atualiza) o dispositivo atual na tabela login_sessions.
 * Deve ser chamado após um login bem-sucedido e ao carregar o app autenticado.
 */
export async function recordDeviceSession(): Promise<void> {
  try {
    if (typeof window === "undefined") return
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const ua = navigator.userAgent
    const { browser, os, deviceName } = parseUserAgent(ua)
    const deviceId = getDeviceId()

    await supabase.from("login_sessions").upsert(
      {
        user_id: user.id,
        device_id: deviceId,
        device_name: deviceName,
        browser,
        os,
        user_agent: ua,
        last_seen: new Date().toISOString(),
      },
      { onConflict: "user_id,device_id" },
    )
  } catch {
    // Registro de dispositivo é best-effort; nunca deve bloquear o fluxo de login.
  }
}
