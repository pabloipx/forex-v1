import { type NextRequest, NextResponse } from "next/server"
import { amplopay } from "@/lib/amplopay"
import { createAdminClient } from "@/lib/supabase/admin"
import { approveDeposit, isPaidStatus } from "@/lib/deposits"
import { validatePromoCode } from "@/lib/promo-codes"

// Valida CPF pelos digitos verificadores. A AmploPay rejeita CPF matematicamente invalido com
// "Documento invalido" (GATEWAY_INVALID_DATA), entao barramos antes de chamar o provedor.
function isValidCpf(raw: string): boolean {
  const cpf = raw.replace(/\D/g, "")
  if (cpf.length !== 11) return false
  if (/^(\d)\1{10}$/.test(cpf)) return false
  let sum = 0
  for (let i = 0; i < 9; i++) sum += Number(cpf[i]) * (10 - i)
  let d1 = (sum * 10) % 11
  if (d1 === 10) d1 = 0
  if (d1 !== Number(cpf[9])) return false
  sum = 0
  for (let i = 0; i < 10; i++) sum += Number(cpf[i]) * (11 - i)
  let d2 = (sum * 10) % 11
  if (d2 === 10) d2 = 0
  return d2 === Number(cpf[10])
}

// A AmploPay valida CADA campo do cliente e recusa a cobranca inteira com GATEWAY_INVALID_DATA
// quando qualquer um esta malformado. Muitos perfis antigos tem dados tortos gravados (e-mail
// invalido, telefone vazio, nome com lixo), entao NUNCA enviamos os campos do perfil direto:
// cada um passa por uma sanitizacao que garante um valor sempre aceito pelo provedor.

// E-mail: recusado com "Invalid email" quando malformado. Usa o do perfil so se for valido,
// senao cai num fallback garantidamente valido.
function sanitizeEmail(raw: string | null | undefined, userId: string): string {
  const email = (raw || "").trim().toLowerCase()
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  if (valid) return email
  return `user-${userId.slice(0, 8)}@urynbrokertrade.com`
}

// Telefone: recusado com "Invalid phone number" quando nao e um numero BR plausivel. Aceita 10
// (fixo) ou 11 (celular) digitos com DDD; remove o codigo de pais "55" quando presente. Se o
// perfil nao tiver um telefone valido, cai num celular padrao valido (NUNCA "00000000000", que a
// AmploPay rejeita).
function sanitizePhone(raw: string | null | undefined): string {
  let digits = (raw || "").replace(/\D/g, "")
  // Remove o codigo de pais BR quando o numero vem com ele (ex.: 55 + DDD + numero).
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) {
    digits = digits.slice(2)
  }
  // DDD valido (11-99) + 10 ou 11 digitos no total.
  const ddd = Number(digits.slice(0, 2))
  const plausivel = (digits.length === 10 || digits.length === 11) && ddd >= 11 && ddd <= 99
  if (plausivel) return digits
  return "11987654321"
}

// Nome: a AmploPay aceita nome com uma palavra so, mas rejeita string vazia ou so com lixo.
// Mantem letras, espacos e acentos; garante um fallback quando nao sobra nada utilizavel.
function sanitizeName(raw: string | null | undefined): string {
  const name = (raw || "")
    .replace(/[^\p{L}\s.'-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
  if (name.length >= 2) return name.slice(0, 80)
  return "Cliente"
}

export async function POST(request: NextRequest) {
  try {
    const { createClient } = await import("@/lib/supabase/server")
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Nao autenticado" }, { status: 401 })
    }

    const supabaseAdmin = createAdminClient()

    const body = await request.json()
    const { amount, promoCode, cpf } = body

    const numericAmount =
      typeof amount === "string" ? Number.parseFloat(amount.replace(/[^\d.,]/g, "").replace(",", ".")) : Number(amount)

    if (isNaN(numericAmount) || numericAmount < 50) {
      return NextResponse.json({ error: "Valor minimo: R$ 50,00" }, { status: 400 })
    }

    // CPF informado pelo lead na tela de deposito. A cobranca PIX e gerada com ESTE documento.
    // Validamos os digitos verificadores AQUI tambem: a AmploPay recusa CPF matematicamente
    // invalido com "Documento invalido" (GATEWAY_INVALID_DATA), e o cliente pode burlar a
    // validacao do front. Barrando no servidor, nunca chamamos o provedor com CPF invalido.
    const cleanCpf = typeof cpf === "string" ? cpf.replace(/\D/g, "") : ""
    if (!isValidCpf(cleanCpf)) {
      return NextResponse.json({ error: "CPF invalido. Confira os numeros e tente novamente." }, { status: 400 })
    }

    // Fetch user profile
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email, phone")
      .eq("id", user.id)
      .maybeSingle()

    const identifier = `DEP-${user.id.slice(0, 8)}-${Date.now()}`

    // Valida o codigo promocional AQUI, no servidor, antes de gravar no deposito. Nunca confiamos
    // no que a tela envia: o bonus e recalculado a partir da campanha no banco.
    // Codigo invalido nao derruba o deposito — apenas nao gera bonus.
    let validatedPromoCode: string | null = null
    if (typeof promoCode === "string" && promoCode.trim()) {
      const validation = await validatePromoCode(supabaseAdmin, promoCode, user.id, numericAmount)
      if (validation.valid) {
        validatedPromoCode = validation.promo.code
      } else {
        console.log(`[v0] Codigo promocional recusado no deposito: ${validation.error}`)
      }
    }

    // Insert deposit record
    const { data: deposit, error: depositError } = await supabaseAdmin
      .from("deposits")
      .insert({
        user_id: user.id,
        amount: numericAmount,
        method: "pix",
        status: "pending",
        external_id: identifier,
        promo_code: validatedPromoCode,
      })
      .select()
      .single()

    if (depositError) {
      console.error("[v0] Deposit insert error:", depositError)
      return NextResponse.json({ error: `Erro ao criar deposito: ${depositError.message}` }, { status: 500 })
    }

    try {
      const pixResponse = await amplopay.createPixPayment({
        amount: numericAmount,
        identifier: identifier,
        client: {
          // Cobranca gerada com o CPF informado pelo lead. Nome/e-mail/telefone vem do perfil,
          // mas SEMPRE sanitizados: a AmploPay valida cada campo e recusa a cobranca inteira se
          // qualquer um estiver malformado. Os sanitizadores garantem valores sempre aceitos.
          name: sanitizeName(profile?.full_name),
          email: sanitizeEmail(profile?.email, user.id),
          phone: sanitizePhone(profile?.phone),
          document: cleanCpf,
        },
        metadata: { userId: user.id, depositId: deposit.id },
      })

      if (!pixResponse.copyPaste) {
        await supabaseAdmin.from("deposits").delete().eq("id", deposit.id)
        return NextResponse.json({ error: "Erro: AmploPay nao retornou codigo PIX" }, { status: 500 })
      }

      // Update deposit with PIX data - save AmploPay internal transaction id for active status check
      //
      // `copy_paste` nao existe na tabela: enquanto era enviada, o Postgres recusava o update
      // INTEIRO, de modo que o QR Code e o `payment_reference` nunca eram salvos. Sem o
      // payment_reference, a verificacao de pagamento e o cron nao conseguiam localizar a cobranca
      // na AmploPay e o deposito ficava pendente para sempre, mesmo pago. O codigo copia-e-cola ja
      // e guardado em `qr_code`, portanto a coluna extra era redundante.
      const { error: pixUpdateError } = await supabaseAdmin
        .from("deposits")
        .update({
          qr_code: pixResponse.copyPaste,
          qr_code_base64: pixResponse.qrCode || "",
          external_id: identifier, // Keep our identifier
          payment_reference: pixResponse.providerTransactionId || null, // ID interno da AmploPay
        })
        .eq("id", deposit.id)

      if (pixUpdateError) {
        console.log("[v0] Erro ao salvar dados do PIX:", pixUpdateError.message)
        await supabaseAdmin.from("deposits").delete().eq("id", deposit.id)
        return NextResponse.json({ error: "Erro ao salvar dados do PIX" }, { status: 500 })
      }

      console.log("[PIX] Created deposit:", deposit.id, "identifier:", identifier, "providerTxId:", pixResponse.providerTransactionId)

      return NextResponse.json({
        success: true,
        deposit_id: deposit.id,
        transaction_id: pixResponse.transactionId,
        qr_code: pixResponse.copyPaste,
        qr_code_base64: pixResponse.qrCode,
        copy_paste: pixResponse.copyPaste,
        amount: numericAmount,
      })
    } catch (pixError: any) {
      console.error("[v0] AmploPay error:", pixError)
      await supabaseAdmin.from("deposits").delete().eq("id", deposit.id)
      return NextResponse.json({ error: pixError.message || "Erro ao gerar PIX" }, { status: 500 })
    }
  } catch (error: any) {
    console.error("[v0] PIX route error:", error)
    return NextResponse.json({ error: error.message || "Erro interno" }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const { createClient } = await import("@/lib/supabase/server")
    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Nao autenticado" }, { status: 401 })
    }

    const supabaseAdmin = createAdminClient()
    const { searchParams } = new URL(request.url)
    const depositId = searchParams.get("deposit_id")

    if (!depositId) {
      return NextResponse.json({ error: "deposit_id e obrigatorio" }, { status: 400 })
    }

    const { data: deposit, error } = await supabaseAdmin
      .from("deposits")
      .select("*")
      .eq("id", depositId)
      .eq("user_id", user.id)
      .maybeSingle()

    if (error || !deposit) {
      return NextResponse.json({ error: "Deposito nao encontrado" }, { status: 404 })
    }

    // VERIFICACAO ATIVA: se ainda esta pendente, consulta o status direto na AmploPay.
    // Isso aprova o deposito automaticamente mesmo quando o webhook nao chega.
    if (deposit.status === "pending" && deposit.payment_reference) {
      try {
        const tx = await amplopay.getTransactionStatus(deposit.payment_reference)
        if (tx && isPaidStatus(tx.status)) {
          const result = await approveDeposit(supabaseAdmin, deposit, tx.id)
          if (result.approved) {
            console.log("[PIX] Deposito aprovado via verificacao ativa:", deposit.id)
          }
          return NextResponse.json({
            status: "approved",
            amount: deposit.amount,
            created_at: deposit.created_at,
            completed_at: new Date().toISOString(),
          })
        }
      } catch (verifyErr) {
        console.error("[PIX] Erro na verificacao ativa:", verifyErr)
        // Em caso de erro, segue retornando o status atual do banco
      }
    }

    return NextResponse.json({
      status: deposit.status,
      amount: deposit.amount,
      created_at: deposit.created_at,
      completed_at: deposit.completed_at,
    })
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
