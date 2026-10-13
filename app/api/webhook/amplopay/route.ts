import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { approveDeposit, isPaidStatus } from "@/lib/deposits"
import { amplopay, WEBHOOK_TOKEN } from "@/lib/amplopay"

// Função para obter cliente admin do Supabase
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  const key = process.env.SUPABASE_SECRET_KEY || ""
  return createClient(url, key)
}

interface AmploPayWebhook {
  transactionId: string
  status: "OK" | "PAID" | "PENDING" | "PROCESSING" | "FAILED" | "CANCELED" | "REFUNDED"
  amount?: number
  pix?: {
    code: string
    base64: string
    image: string
  }
  metadata?: {
    userId?: string
    depositId?: string
    provider?: string
  }
  // Formato alternativo
  event?: string
  transaction?: {
    id: string
    identifier: string
    status: string
    amount: number
  }
}

export async function POST(request: NextRequest) {
  // Verificar se Supabase está configurado
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 })
  }

  const supabaseAdmin = getSupabaseAdmin()

  // Token secreto na query string do callbackUrl. Se conferir, o POST comprovadamente veio da
  // AmploPay (ninguem de fora conhece a chave privada que gera o token), o que autoriza credito
  // imediato pelo payload sem reabrir o risco de forgery.
  const authentic = !!WEBHOOK_TOKEN && (request.nextUrl.searchParams.get("token") || "") === WEBHOOK_TOKEN

  try {
    const body: AmploPayWebhook = await request.json()
    
    console.log("[WEBHOOK] Received AmploPay webhook:", JSON.stringify(body, null, 2))

    // Extrair dados do webhook (suporta ambos os formatos)
    const transactionId = body.transactionId || body.transaction?.id || ""
    const identifier = body.metadata?.depositId || body.transaction?.identifier || ""
    const status = body.status || body.transaction?.status || ""
    const event = body.event || ""

    console.log("[WEBHOOK] Extracted data:", { transactionId, identifier, status, event })

    // Buscar depósito por múltiplos critérios
    let deposit = null
    
    // AmploPay usa nosso identifier (DEP-xxx) como transactionId
    const searchIdentifier = identifier || transactionId

    // 1. Tentar por external_id (nosso identifier DEP-xxx)
    if (!deposit && searchIdentifier) {
      const { data } = await supabaseAdmin.from("deposits").select("*").eq("external_id", searchIdentifier).maybeSingle()
      deposit = data
      console.log("[WEBHOOK] Search by external_id:", searchIdentifier, deposit ? "found" : "not found")
    }

    // 2. Tentar por depositId UUID se for UUID válido
    if (!deposit && searchIdentifier?.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
      const { data } = await supabaseAdmin.from("deposits").select("*").eq("id", searchIdentifier).maybeSingle()
      deposit = data
      console.log("[WEBHOOK] Search by UUID id:", deposit ? "found" : "not found")
    }

    // 3. Tentar por payment_reference
    if (!deposit && transactionId) {
      const { data } = await supabaseAdmin.from("deposits").select("*").eq("payment_reference", transactionId).maybeSingle()
      deposit = data
      console.log("[WEBHOOK] Search by payment_reference:", deposit ? "found" : "not found")
    }

    // 4. Buscar depósito pendente mais recente pelo userId nos metadados
    if (!deposit && body.metadata?.userId) {
      const { data } = await supabaseAdmin
        .from("deposits")
        .select("*")
        .eq("user_id", body.metadata.userId)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      deposit = data
      console.log("[WEBHOOK] Search by userId pending:", deposit ? "found" : "not found")
    }

    // 5. Buscar depósito pendente mais recente pelo valor (fallback)
    if (!deposit && body.amount) {
      const { data } = await supabaseAdmin
        .from("deposits")
        .select("*")
        .eq("amount", body.amount)
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle()
      deposit = data
      console.log("[WEBHOOK] Search by amount pending:", body.amount, deposit ? "found" : "not found")
    }

    if (!deposit) {
      console.log("[WEBHOOK] Deposit not found for any criteria:", { identifier, transactionId, searchIdentifier })
      return NextResponse.json({ error: "Deposit not found", searched: { identifier, transactionId } }, { status: 404 })
    }

    console.log("[WEBHOOK] Found deposit:", deposit.id, "status:", deposit.status)

    // Se já foi processado, ignorar
    if (deposit.status === "approved") {
      return NextResponse.json({ success: true, message: "Already processed" })
    }

    const su = status.toUpperCase()
    const payloadSaysPaid = su === "PAID" || su === "OK" || su === "COMPLETED" || su === "APPROVED" || event === "TRANSACTION_PAID" || event === "PAYMENT_CONFIRMED"
    const isFailed = su === "FAILED" || su === "CANCELED" || su === "CANCELLED" || event === "TRANSACTION_CANCELED"
    const isRefunded = su === "REFUNDED" || event === "TRANSACTION_REFUNDED"

    // SEGURANCA: o corpo do webhook NAO e assinado e pode ser forjado. Um atacante poderia enviar
    // um POST com status "PAID" e o identificador de um deposito pendente para creditar saldo sem
    // ter pago nada. Por isso NUNCA creditamos confiando no corpo do webhook: o pagamento e SEMPRE
    // reconfirmado direto na AmploPay pelo ID da transacao (fonte oficial). O valor efetivamente
    // creditado vem do nosso proprio registro de deposito, nunca do payload.
    let isPaid = false
    if (!isFailed && !isRefunded) {
      // Reconfirmacao ativa na AmploPay. O ID a consultar TEM que ser o ID INTERNO da AmploPay
      // (ex.: "cmqnxz0cq..."), que guardamos em `deposit.payment_reference` quando o PIX foi
      // criado. O `transactionId` que chega no corpo do webhook e o NOSSO identificador
      // (DEP-xxx) - e por isso que a busca do deposito acima procura por `external_id` com ele.
      // Consultar /gateway/transactions?id=DEP-xxx nao acha nada (retorna null), entao o webhook
      // nunca conseguia confirmar o pagamento e o deposito NUNCA era creditado sozinho - so pelo
      // polling (tela aberta) ou pelo cron diario. Por isso preferimos `payment_reference`, o
      // mesmo ID que o polling e o cron ja usam com sucesso; `transactionId` fica so de fallback.
      const providerRef = deposit.payment_reference || transactionId
      if (providerRef) {
        try {
          const tx = await amplopay.getTransactionStatus(providerRef)
          if (tx && isPaidStatus(tx.status)) isPaid = true
        } catch (verifyErr) {
          console.error("[WEBHOOK] Erro na confirmacao ativa:", verifyErr)
        }
      }

      if (!isPaid && payloadSaysPaid) {
        if (authentic) {
          // Webhook AUTENTICADO (o token secreto confere) afirmando pago. O token so pode ter sido
          // gerado por nos e enviado de volta pela AmploPay na URL do callback, entao este payload
          // e confiavel - nao ha risco de forgery. Creditamos na hora mesmo que a reconfirmacao
          // ativa nao tenha confirmado agora (lag de consistencia da AmploPay ou API momentaneamente
          // fora). Isso restaura a aprovacao instantanea que existia antes do hardening.
          console.log("[WEBHOOK] Pagamento confirmado por webhook autenticado (token valido).", {
            depositId: deposit.id,
          })
          isPaid = true
        } else {
          // Payload diz "pago" mas SEM token valido e sem confirmacao ativa: pode ser forjado ou
          // um webhook antigo (criado antes do token). NAO creditamos agora - o polling de
          // /api/pix, a reconciliacao no foco da aba e o cron reconfirmam depois pela fonte oficial
          // e creditam entao. Um credito atrasado e sempre preferivel a um credito forjado.
          console.warn("[WEBHOOK] Pagamento nao confirmado ativamente e webhook sem token valido; credito adiado.", {
            depositId: deposit.id,
          })
        }
      }
    }

    if (isPaid) {
      try {
        const result = await approveDeposit(supabaseAdmin, deposit, transactionId || deposit.payment_reference)
        return NextResponse.json({
          success: true,
          message: result.alreadyProcessed ? "Already processed" : "Payment processed",
          new_balance: result.newBalance,
        })
      } catch (approveError: any) {
        console.error("[WEBHOOK] Error approving deposit:", approveError)
        return NextResponse.json({ error: approveError.message || "Error approving deposit" }, { status: 500 })
      }
    } else if (isFailed) {
      await supabaseAdmin.from("deposits").update({ status: "failed" }).eq("id", deposit.id)
      return NextResponse.json({ success: true, message: "Payment failed" })
    } else if (isRefunded) {
      await supabaseAdmin.from("deposits").update({ status: "refunded" }).eq("id", deposit.id)
      return NextResponse.json({ success: true, message: "Payment refunded" })
    }

    return NextResponse.json({ success: true, message: "Status received" })
  } catch (error: any) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

// Responder a verificação de saúde
export async function GET() {
  return NextResponse.json({ status: "ok", service: "amplopay-webhook" })
}
