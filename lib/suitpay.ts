import { createHash, timingSafeEqual } from "crypto"

const HOST =
  process.env.SUITPAY_ENV?.trim().toLowerCase() === "sandbox"
    ? "https://sandbox.ws.suitpay.app"
    : "https://ws.suitpay.app"

const CLIENT_ID = process.env.SUITPAY_CLIENT_ID?.trim() || ""
const CLIENT_SECRET = process.env.SUITPAY_CLIENT_SECRET?.trim() || ""

// O webhook precisa apontar para o dominio canonico sem redirecionamento: o apex responde 308 para
// o www, e nao da para contar com o provedor seguindo redirect em POST.
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://www.profittradingglobal.com").replace(/\/+$/, "")
const CALLBACK_URL = `${APP_URL}/api/webhook/suitpay`

export const SUITPAY_REQUEST_PREFIX = "SP-"

export function isSuitpayConfigured(): boolean {
  return Boolean(CLIENT_ID && CLIENT_SECRET)
}

interface PixChargeInput {
  requestNumber: string
  amount: number
  client: { name: string; document: string; email: string; phoneNumber: string }
}

export interface PixCharge {
  idTransaction: string
  paymentCode: string
  paymentCodeBase64: string
}

async function call<T>(path: string, body: unknown): Promise<T> {
  if (!isSuitpayConfigured()) {
    throw new Error("Gateway PIX nao configurado")
  }

  const res = await fetch(`${HOST}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ci: CLIENT_ID, cs: CLIENT_SECRET },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  })

  const text = await res.text()
  let data: unknown = text
  try {
    data = JSON.parse(text)
  } catch {}

  if (!res.ok) {
    const message =
      (typeof data === "object" && data && "message" in data && String((data as { message: unknown }).message)) ||
      (res.status === 401 ? "Credenciais da SuitPay invalidas" : `SuitPay respondeu ${res.status}`)
    console.error("[SUITPAY]", path, res.status, text.slice(0, 500))
    throw new Error(message)
  }

  return data as T
}

function tomorrow(): string {
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

export async function createPixCharge(input: PixChargeInput): Promise<PixCharge> {
  const data = await call<Partial<PixCharge> & { response?: string; message?: string }>(
    "/api/v1/gateway/request-qrcode",
    {
      requestNumber: input.requestNumber,
      dueDate: tomorrow(),
      amount: Math.round(input.amount * 100) / 100,
      shippingAmount: 0,
      discountAmount: 0,
      usernameCheckout: "checkout",
      callbackUrl: CALLBACK_URL,
      client: input.client,
    },
  )

  if (!data?.idTransaction || !data.paymentCode) {
    console.error("[SUITPAY] Resposta sem QR Code:", JSON.stringify(data).slice(0, 500))
    throw new Error(data?.message || "SuitPay nao retornou o codigo PIX")
  }

  return {
    idTransaction: String(data.idTransaction),
    paymentCode: data.paymentCode,
    paymentCodeBase64: data.paymentCodeBase64 || "",
  }
}

export async function getTransactionStatus(idTransaction: string): Promise<{ id: string; status: string } | null> {
  const data = await call<unknown>("/api/v1/gateway/consult-status-transaction", {
    typeTransaction: "PIX",
    idTransaction,
  })

  const status =
    typeof data === "string"
      ? data
      : typeof data === "object" && data
        ? String(
            (data as Record<string, unknown>).statusTransaction ?? (data as Record<string, unknown>).status ?? "",
          )
        : ""

  return status ? { id: idTransaction, status } : null
}

export type GatewayHealth = {
  status: "online" | "auth_error" | "offline" | "not_configured"
  latencyMs: number | null
  httpStatus: number | null
  message: string
  environment: "sandbox" | "production"
  host: string
  callbackUrl: string
  checkedAt: string
}

/**
 * Faz uma consulta de status com um id inexistente: não cria cobrança nem altera nada. Qualquer
 * resposta que não seja 401/403/5xx — ou o servidor encerrando a conexão — indica API no ar.
 */
export async function pingSuitpay(): Promise<GatewayHealth> {
  const base = {
    environment: HOST.includes("sandbox") ? ("sandbox" as const) : ("production" as const),
    host: HOST,
    callbackUrl: CALLBACK_URL,
    checkedAt: new Date().toISOString(),
  }
  if (!isSuitpayConfigured()) {
    return { ...base, status: "not_configured", latencyMs: null, httpStatus: null, message: "Credenciais não configuradas" }
  }
  const started = performance.now()
  try {
    const res = await fetch(`${HOST}/api/v1/gateway/consult-status-transaction`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ci: CLIENT_ID, cs: CLIENT_SECRET },
      body: JSON.stringify({ typeTransaction: "PIX", idTransaction: "healthcheck" }),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    })
    await res.text().catch(() => "")
    const latencyMs = Math.round(performance.now() - started)
    if (res.status === 401 || res.status === 403) {
      return { ...base, status: "auth_error", latencyMs, httpStatus: res.status, message: "API respondeu, mas recusou as credenciais" }
    }
    if (res.status >= 500) {
      return { ...base, status: "offline", latencyMs, httpStatus: res.status, message: `Erro no servidor da SuitPay (${res.status})` }
    }
    return { ...base, status: "online", latencyMs, httpStatus: res.status, message: "API respondendo normalmente" }
  } catch (e) {
    const timeout = (e as Error).name === "TimeoutError"
    const cause = String(((e as Error & { cause?: { message?: string } }).cause?.message) ?? "")
    // A SuitPay encerra a conexao quando recebe uma consulta de transacao inexistente. Se o socket
    // fechou depois de conectar, o servidor esta no ar; so DNS/timeout/recusa de TCP indicam queda.
    const closedByServer = /other side closed|ECONNRESET|socket hang up/i.test(cause)
    if (closedByServer) {
      return {
        ...base,
        status: "online",
        latencyMs: Math.round(performance.now() - started),
        httpStatus: null,
        message: "API no ar e respondendo",
      }
    }
    return {
      ...base,
      status: "offline",
      latencyMs: timeout ? null : Math.round(performance.now() - started),
      httpStatus: null,
      message: timeout ? "Sem resposta em 8 s" : "Falha de conexão com a SuitPay",
    }
  }
}

/**
 * Valida o hash do webhook: SHA-256(cs + valores concatenados na ordem recebida, sem o hash).
 * Usa o texto bruto do corpo para preservar a forma original dos numeros (ex.: "10.50"), que o
 * JSON.parse comum perderia ao converter para 10.5.
 */
export function verifyWebhookHash(rawBody: string): boolean {
  if (!CLIENT_SECRET) return false

  const values: string[] = []
  let received = ""

  try {
    JSON.parse(rawBody, function (key: string, value: unknown, ctx?: { source?: string }) {
      if (this && typeof this === "object" && !Array.isArray(this) && key !== "") {
        if (key === "hash") {
          received = String(value ?? "")
        } else if (value !== null && typeof value !== "object") {
          values.push(typeof value === "number" && ctx?.source ? ctx.source : String(value))
        }
      }
      return value
    })
  } catch {
    return false
  }

  if (!/^[a-f0-9]{64}$/i.test(received)) return false

  const expected = createHash("sha256").update(CLIENT_SECRET + values.join("")).digest("hex")
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(received.toLowerCase(), "hex"))
}
