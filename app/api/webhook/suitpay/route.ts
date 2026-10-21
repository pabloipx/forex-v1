import { type NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { approveDeposit, isCreditedStatus, isPaidStatus } from "@/lib/deposits"
import { getTransactionStatus, verifyWebhookHash } from "@/lib/suitpay"

export const dynamic = "force-dynamic"

interface SuitpayWebhook {
  idTransaction?: string
  typeTransaction?: string
  statusTransaction?: string
  value?: number
  requestNumber?: string
}

export async function POST(request: NextRequest) {
  const raw = await request.text()

  let body: SuitpayWebhook
  try {
    body = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const idTransaction = String(body.idTransaction || "")
  const requestNumber = String(body.requestNumber || "")
  const status = String(body.statusTransaction || "").toUpperCase()

  if (body.typeTransaction && body.typeTransaction.toUpperCase() !== "PIX") {
    return NextResponse.json({ success: true, message: "Ignored" })
  }
  if (!idTransaction && !requestNumber) {
    return NextResponse.json({ error: "Missing transaction" }, { status: 400 })
  }

  const supabaseAdmin = createAdminClient()

  let deposit = null
  if (requestNumber) {
    const { data } = await supabaseAdmin.from("deposits").select("*").eq("external_id", requestNumber).maybeSingle()
    deposit = data
  }
  if (!deposit && idTransaction) {
    const { data } = await supabaseAdmin.from("deposits").select("*").eq("payment_reference", idTransaction).maybeSingle()
    deposit = data
  }

  if (!deposit) {
    console.warn("[SUITPAY WEBHOOK] Deposito nao encontrado:", { requestNumber, idTransaction })
    return NextResponse.json({ error: "Deposit not found" }, { status: 404 })
  }

  if (deposit.payment_reference && idTransaction && deposit.payment_reference !== idTransaction) {
    console.warn("[SUITPAY WEBHOOK] idTransaction nao confere com o deposito:", deposit.id)
    return NextResponse.json({ error: "Transaction mismatch" }, { status: 400 })
  }

  if (status === "CHARGEBACK") {
    if (!isCreditedStatus(deposit.status)) {
      await supabaseAdmin.from("deposits").update({ status: "refunded" }).eq("id", deposit.id)
    } else {
      console.warn("[SUITPAY WEBHOOK] Estorno de deposito ja creditado - revisar manualmente:", deposit.id)
    }
    return NextResponse.json({ success: true, message: "Chargeback received" })
  }

  if (isCreditedStatus(deposit.status)) {
    return NextResponse.json({ success: true, message: "Already processed" })
  }

  if (!isPaidStatus(status)) {
    return NextResponse.json({ success: true, message: "Status received" })
  }

  // O hash assinado com o Client Secret prova a origem. Se ele nao bater, nao creditamos pelo
  // corpo: reconfirmamos direto na SuitPay antes.
  const paidValue = Number(body.value)
  const hashValid = verifyWebhookHash(raw) && Number.isFinite(paidValue) && paidValue + 0.009 >= Number(deposit.amount)

  let confirmed = hashValid
  if (!confirmed) {
    try {
      const tx = await getTransactionStatus(deposit.payment_reference || idTransaction)
      confirmed = Boolean(tx && isPaidStatus(tx.status))
    } catch (err) {
      console.error("[SUITPAY WEBHOOK] Erro na reconfirmacao:", err)
    }
  }

  if (!confirmed) {
    console.warn("[SUITPAY WEBHOOK] Pagamento nao confirmado; credito adiado:", deposit.id)
    return NextResponse.json({ success: false, message: "Not confirmed" }, { status: 202 })
  }

  try {
    const result = await approveDeposit(supabaseAdmin, deposit, idTransaction || deposit.payment_reference)
    return NextResponse.json({
      success: true,
      message: result.alreadyProcessed ? "Already processed" : "Payment processed",
    })
  } catch (err) {
    console.error("[SUITPAY WEBHOOK] Erro ao aprovar deposito:", err)
    return NextResponse.json({ error: "Error approving deposit" }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ status: "ok", service: "suitpay-webhook" })
}
