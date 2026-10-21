// Bloqueio progressivo de tentativas de login do admin, por IP.
// Fica em memoria da instancia: ja impede ataques de forca bruta comuns sem
// depender de um servico externo.

const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000
const LOCK_MS = 15 * 60 * 1000

type Entry = { count: number; firstAt: number; lockedUntil: number }

const attempts = new Map<string, Entry>()

function prune(now: number) {
  if (attempts.size < 5000) return
  for (const [key, entry] of attempts) {
    if (entry.lockedUntil < now && now - entry.firstAt > WINDOW_MS) attempts.delete(key)
  }
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",")[0].trim()
  return request.headers.get("x-real-ip") || "unknown"
}

/** Segundos restantes de bloqueio, ou 0 se o IP pode tentar. */
export function getLockSeconds(ip: string): number {
  const entry = attempts.get(ip)
  if (!entry) return 0
  const now = Date.now()
  return entry.lockedUntil > now ? Math.ceil((entry.lockedUntil - now) / 1000) : 0
}

export function registerFailure(ip: string): number {
  const now = Date.now()
  prune(now)
  let entry = attempts.get(ip)
  if (!entry || now - entry.firstAt > WINDOW_MS) {
    entry = { count: 0, firstAt: now, lockedUntil: 0 }
  }
  entry.count += 1
  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = now + LOCK_MS
    entry.count = 0
    entry.firstAt = now
  }
  attempts.set(ip, entry)
  return getLockSeconds(ip)
}

export function clearFailures(ip: string) {
  attempts.delete(ip)
}
