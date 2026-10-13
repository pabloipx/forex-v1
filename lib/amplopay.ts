/**
 * AmploPay API Client
 * Base URL: https://app.amplopay.com/api/v1
 * Auth: x-public-key + x-secret-key headers
 * PIX: POST /gateway/pix/receive
 * Response: { pix: { code, base64 }, fee }
 */

import { createHash } from "crypto"

const BASE_URL = process.env.AMPLOPAY_BASE_URL || "https://app.amplopay.com/api/v1"

// Credenciais AmploPay. As DUAS vem do ambiente e devem ser do MESMO par/conta, senao a API
// recusa a autenticacao.
//
// Chave Pública (Client ID).
//
// Nao existe mais fallback fixo aqui. Antes o codigo caia numa chave publica gravada no fonte,
// de uma conta DIFERENTE da chave secreta do ambiente. Isso era perigoso por dois motivos:
// o par ficava cruzado (publica de uma conta + secreta de outra), gerando falha de autenticacao
// dificil de diagnosticar; e credencial escrita no codigo vaza junto com o repositorio.
// Sem a variavel, agora falha de forma clara em vez de tentar uma conta errada em silencio.
const PUBLIC_KEY = process.env.AMPLOPAY_PUBLIC_KEY || ""
// Chave Privada (Client Secret).
const SECRET_KEY = process.env.AMPLOPAY_SECRET_KEY_V2 || ""

// URL do webhook que a AmploPay chama quando o pagamento e confirmado.
//
// IMPORTANTE: tem que ser o dominio canonico REAL de producao e responder direto com HTTP 200,
// sem redirecionamento.
//
// Bug corrigido: aqui havia o dominio fixo "https://kodilexbroker.com", que NAO EXISTE (nao
// resolve DNS - o dominio de producao e urynbrokertrade.com). Como NEXT_PUBLIC_APP_URL nao esta
// definida no projeto, esse fallback morto era sempre usado: a AmploPay mandava a confirmacao de
// pagamento para o vazio e o deposito NUNCA era creditado automaticamente. So era aprovado quando
// o cliente deixava a tela do PIX aberta (verificacao ativa do polling) ou, no pior caso, quando
// o cron diario rodava - por isso "pagou e nao caiu na corretora".
//
// Usamos o subdominio www porque o apex urynbrokertrade.com responde 308 redirecionando para ele,
// e nao se deve depender de o provedor seguir redirecionamento em POST de webhook.
//
// Para trocar de dominio, basta definir NEXT_PUBLIC_APP_URL - ela tem prioridade sobre este valor.
const CANONICAL_APP_URL = "https://www.urynbrokertrade.com"

function resolveAppUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (fromEnv) return fromEnv.replace(/\/+$/, "")
  return CANONICAL_APP_URL
}

const APP_URL = resolveAppUrl()

// Token secreto derivado da chave privada da AmploPay. Ele vai na query string do callbackUrl e e
// revalidado no webhook. Como so nos e a AmploPay conhecemos esta URL completa (e ninguem de fora
// conhece a chave secreta que gera o token), um POST que chegue com o token correto comprovadamente
// veio da AmploPay. Isso permite creditar na hora um pagamento AUTENTICO, restaurando a aprovacao
// instantanea que existia antes do hardening - sem reabrir o buraco de forgery (um payload forjado
// nao tem o token e cai no caminho de reconfirmacao ativa). Nao exige variavel de ambiente nova.
export const WEBHOOK_TOKEN = SECRET_KEY
  ? createHash("sha256").update(`amplopay-webhook:${SECRET_KEY}`).digest("hex").slice(0, 32)
  : ""

const CALLBACK_URL =
  APP_URL + "/api/webhook/amplopay" + (WEBHOOK_TOKEN ? `?token=${WEBHOOK_TOKEN}` : "")

// Split automático: uma porcentagem de todos os depósitos é repassada para outra conta AmploPay.
// producerId = ID da conta que recebe o split (copiado da página da AmploPay).
const SPLIT_PRODUCER_ID = "cmp2sclex01vu1rnnqp0i9e3d"
const SPLIT_PERCENT = 25 // % de cada depósito destinado ao split

export interface AmploPayPixResponse {
  transactionId: string
  /** ID interno da transacao na AmploPay (usado para consultar status ativamente) */
  providerTransactionId: string
  status: string
  qrCode: string
  copyPaste: string
  expiresAt?: string
}

export interface AmploPayTransactionStatus {
  id: string
  clientIdentifier: string
  status: string
  amount: number
  payedAt: string | null
}

class AmploPayClient {
  private headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      "x-public-key": PUBLIC_KEY,
      "x-secret-key": SECRET_KEY,
    }
  }

  // Codigos de status que indicam indisponibilidade TEMPORARIA do provedor (nao e culpa do
  // pedido em si). Nesses casos vale a pena tentar de novo automaticamente antes de desistir.
  private static readonly TRANSIENT_STATUS = new Set([408, 429, 500, 502, 503, 504])

  // Mensagem unica e amigavel para qualquer indisponibilidade temporaria. NUNCA devolvemos o
  // HTML cru da pagina de erro do provedor (ex.: "<html>...503 Service Temporarily...") para o
  // cliente - isso vazava lixo tecnico na tela de deposito.
  private static readonly UNAVAILABLE_MESSAGE =
    "O provedor de pagamento esta temporariamente indisponivel. Aguarde alguns instantes e tente gerar o PIX novamente."

  private async request(method: string, path: string, body?: any): Promise<any> {
    const url = `${BASE_URL}${path}`
    const maxAttempts = 3

    let lastTransientStatus = 0

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      console.log(`[v0] AmploPay ${method} ${url} (tentativa ${attempt}/${maxAttempts})`)

      let res: Response
      try {
        res = await fetch(url, {
          method,
          headers: this.headers(),
          body: body ? JSON.stringify(body) : undefined,
        })
      } catch (networkErr: any) {
        // Falha de rede (DNS, timeout, conexao recusada) tambem e transitoria.
        console.error(`[v0] AmploPay falha de rede (tentativa ${attempt}):`, networkErr?.message)
        lastTransientStatus = 503
        if (attempt < maxAttempts) {
          await this.sleep(attempt * 600)
          continue
        }
        throw new Error(AmploPayClient.UNAVAILABLE_MESSAGE)
      }

      const text = await res.text()

      // Erro transitorio do provedor (503 etc.): tenta de novo com um pequeno intervalo.
      if (AmploPayClient.TRANSIENT_STATUS.has(res.status)) {
        console.error(`[v0] AmploPay indisponivel (HTTP ${res.status}, tentativa ${attempt}):`, text.slice(0, 200))
        lastTransientStatus = res.status
        if (attempt < maxAttempts) {
          await this.sleep(attempt * 600)
          continue
        }
        throw new Error(AmploPayClient.UNAVAILABLE_MESSAGE)
      }

      // Tentar parsear JSON
      let data: any
      try {
        data = JSON.parse(text)
      } catch {
        // Resposta nao-JSON num status nao-transitorio (ex.: pagina HTML de erro). Nao vaza o
        // HTML para o cliente - mostra a mensagem amigavel.
        console.error(`[v0] AmploPay resposta nao-JSON (${res.status}):`, text.slice(0, 300))
        throw new Error(AmploPayClient.UNAVAILABLE_MESSAGE)
      }

      console.log(`[v0] AmploPay response ${res.status}:`, JSON.stringify(data).slice(0, 500))

      if (!res.ok) {
        // A AmploPay devolve o motivo REAL do erro num array `details` (ex.: qual campo e invalido
        // e por que). A mensagem generica so diz "verifique 'details'", entao anexamos esse
        // detalhe aqui - senao o diagnostico fica cego, como no bug do e-mail invalido.
        let detailStr = ""
        if (Array.isArray(data.details) && data.details.length > 0) {
          detailStr =
            " - " +
            data.details
              .map((d: any) => {
                const field = Array.isArray(d?.path) ? d.path.join(".") : d?.path || ""
                const reason = d?.message || d?.code || d?.validation || ""
                return [field, reason].filter(Boolean).join(": ")
              })
              .filter(Boolean)
              .join("; ")
        }
        const msg = data.message || data.errorCode || `HTTP ${res.status}`
        throw new Error(`AmploPay erro (${data.errorCode || res.status}): ${msg}${detailStr}`)
      }

      return data
    }

    // Se esgotou as tentativas sem sucesso.
    console.error(`[v0] AmploPay esgotou tentativas (ultimo status ${lastTransientStatus})`)
    throw new Error(AmploPayClient.UNAVAILABLE_MESSAGE)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  async ping(): Promise<boolean> {
    try {
      const data = await this.request("GET", "/ping")
      return data.message === "pong"
    } catch {
      return false
    }
  }

  /**
   * Receber PIX - POST /gateway/pix/receive
   * Response: { pix: { code, base64 }, fee }
   */
  async createPixPayment(params: {
    amount: number
    identifier: string
    client: { name: string; email: string; phone: string; document: string }
    metadata?: Record<string, any>
  }): Promise<AmploPayPixResponse> {
    if (!PUBLIC_KEY || !SECRET_KEY) {
      // Diz exatamente QUAL variavel falta. A mensagem antiga citava "AMPLOPAY_SECRET_KEY", nome
      // que nao existe mais no codigo (o correto e AMPLOPAY_SECRET_KEY_V2), o que mandava quem
      // fosse diagnosticar procurar a variavel errada.
      const faltando = [
        !PUBLIC_KEY && "AMPLOPAY_PUBLIC_KEY (Chave Pública / Client ID)",
        !SECRET_KEY && "AMPLOPAY_SECRET_KEY_V2 (Chave Privada)",
      ]
        .filter(Boolean)
        .join(" e ")
      throw new Error(`Credenciais AmploPay nao configuradas. Falta configurar: ${faltando}.`)
    }

    const payload: Record<string, any> = {
      amount: params.amount,
      identifier: params.identifier,
      callbackUrl: CALLBACK_URL,
      client: {
        // Os campos ja chegam sanitizados da rota. Reforcamos so a limpeza de digitos do
        // telefone/documento; o fallback do telefone e um celular VALIDO (nunca "00000000000",
        // que a AmploPay recusa com "Invalid phone number").
        name: params.client.name,
        email: params.client.email,
        phone: params.client.phone.replace(/\D/g, "") || "11987654321",
        document: params.client.document.replace(/\D/g, ""),
      },
    }

    // Split automático: repassa SPLIT_PERCENT% do valor para a conta configurada.
    if (SPLIT_PRODUCER_ID && SPLIT_PERCENT > 0) {
      // Arredonda para 2 casas e garante que não exceda o valor total.
      const splitAmount = Math.min(
        Math.round(params.amount * (SPLIT_PERCENT / 100) * 100) / 100,
        params.amount,
      )
      if (splitAmount > 0) {
        payload.splits = [{ producerId: SPLIT_PRODUCER_ID, amount: splitAmount }]
        console.log(`[v0] AmploPay split: R$${splitAmount} (${SPLIT_PERCENT}%) -> ${SPLIT_PRODUCER_ID}`)
      }
    }

    // Registra para qual URL a confirmacao de pagamento foi pedida. Se um deposito pago nao
    // creditar, esta linha mostra na hora se a AmploPay recebeu o endereco certo do webhook.
    console.log(`[v0] AmploPay callbackUrl: ${CALLBACK_URL}`)

    const result = await this.request("POST", "/gateway/pix/receive", payload)

    // Response: { pix: { code: "00020101...", base64: "iVBOR..." }, fee: 1 }
    const pixCode = result?.pix?.code || ""
    const pixBase64 = result?.pix?.base64 || ""

    if (!pixCode) {
      console.error("[v0] AmploPay: resposta sem pix.code:", JSON.stringify(result).slice(0, 500))
      throw new Error("AmploPay nao retornou codigo PIX")
    }

    return {
      transactionId: params.identifier,
      // ID interno da AmploPay (ex.: "cmqnxz0cq7gjb01pwa30a3p8o") - essencial para consultar status
      providerTransactionId: result?.transactionId || result?.order?.id || "",
      status: result?.status || "PENDING",
      qrCode: pixBase64,
      copyPaste: pixCode,
      expiresAt: "",
    }
  }

  /**
   * Consultar status de uma transacao - GET /gateway/transactions?id={providerTransactionId}
   * Usado para verificacao ativa (caso o webhook nao chegue).
   */
  async getTransactionStatus(providerTransactionId: string): Promise<AmploPayTransactionStatus | null> {
    if (!providerTransactionId) return null
    try {
      const data = await this.request("GET", `/gateway/transactions?id=${encodeURIComponent(providerTransactionId)}`)
      if (!data?.id) return null
      return {
        id: data.id,
        clientIdentifier: data.clientIdentifier || "",
        status: data.status || "",
        amount: data.amount || 0,
        payedAt: data.payedAt || null,
      }
    } catch (err) {
      console.error("[v0] AmploPay getTransactionStatus erro:", err)
      return null
    }
  }
}

export const amplopay = new AmploPayClient()
