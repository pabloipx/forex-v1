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

/** Extrai navegador, sistema, tipo e modelo do aparelho a partir do user agent. */
export function parseUserAgent(ua: string): { browser: string; os: string; deviceName: string; model: string | null } {
  let browser = "Navegador"
  if (/Edg\//i.test(ua)) browser = "Microsoft Edge"
  else if (/OPR\/|Opera/i.test(ua)) browser = "Opera"
  else if (/SamsungBrowser/i.test(ua)) browser = "Samsung Internet"
  else if (/CriOS|Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = "Google Chrome"
  else if (/FxiOS|Firefox\//i.test(ua)) browser = "Firefox"
  else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = "Safari"

  let os = "Desconhecido"
  if (/Windows NT/i.test(ua)) os = "Windows"
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS"
  else if (/Mac OS X/i.test(ua)) os = "macOS"
  else if (/Android/i.test(ua)) os = "Android"
  else if (/Linux/i.test(ua)) os = "Linux"

  const version =
    ua.match(/Android ([\d.]+)/i)?.[1] ?? ua.match(/OS (\d+[_\d]*) like Mac/i)?.[1]?.replace(/_/g, ".") ?? null
  if (version) os = `${os} ${version}`

  let model: string | null = null
  if (/iPhone/i.test(ua)) model = "iPhone"
  else if (/iPad/i.test(ua)) model = "iPad"
  else {
    const m = ua.match(/Android [\d.]+; (?:[a-z]{2}[-_][a-z]{2}; )?([^;)]+?)(?: Build|\))/i)?.[1]?.trim()
    if (m && m !== "K") model = m
  }

  const isTablet = /iPad|Tablet/i.test(ua)
  const isMobile = !isTablet && /iPhone|iPod|Android.*Mobile|Mobile/i.test(ua)
  const deviceName = `${isTablet ? "Tablet" : isMobile ? "Celular" : "Computador"} · ${os.split(" ")[0]}`
  return { browser, os, deviceName, model }
}

async function detectModel(): Promise<string | null> {
  const uaData = (navigator as Navigator & {
    userAgentData?: { getHighEntropyValues?: (hints: string[]) => Promise<{ model?: string }> }
  }).userAgentData
  try {
    const v = await uaData?.getHighEntropyValues?.(["model"])
    return v?.model || null
  } catch {
    return null
  }
}

/**
 * Registra o dispositivo atual (com IP e cidade detectados no servidor).
 * Use event "login" após login/cadastro e "seen" ao abrir o app autenticado.
 */
export async function recordDeviceSession(event: "login" | "seen" = "login"): Promise<void> {
  try {
    if (typeof window === "undefined") return
    await fetch("/api/session/record", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ deviceId: getDeviceId(), event, model: await detectModel() }),
      keepalive: true,
    })
  } catch {
    // Registro de dispositivo é best-effort; nunca deve bloquear o fluxo de login.
  }
}
