import { createClient, createAdminClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

/** Identifica a bandeira pelos digitos iniciais, para exibir junto dos 4 ultimos digitos. */
function detectCardBrand(cardNumber: string): string {
  // Elo e Hipercard sao verificados ANTES de Visa/Mastercard: varios prefixos Elo comecam com 4
  // (ex.: 4011) e seriam classificados como Visa se a ordem fosse invertida.
  if (/^(4011|4312|4389|4514|4573|5041|5066|5090|6277|6363)/.test(cardNumber)) return "elo"
  if (/^(606282|3841)/.test(cardNumber)) return "hipercard"
  if (/^4/.test(cardNumber)) return "visa"
  if (/^(5[1-5]|2[2-7])/.test(cardNumber)) return "mastercard"
  if (/^3[47]/.test(cardNumber)) return "amex"
  if (/^(30[0-5]|36|38)/.test(cardNumber)) return "diners"
  if (/^(6011|64[4-9]|65)/.test(cardNumber)) return "discover"
  return "unknown"
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })
    }

    const { fullName, cardNumber, expiryDate, cvv, cpf, amount } = await request.json()

    // Validations
    if (!fullName || fullName.trim().length < 3) {
      return NextResponse.json({ error: "Nome completo e obrigatorio" }, { status: 400 })
    }

    const cleanCard = (cardNumber || "").replace(/\s/g, "")
    if (!cleanCard || cleanCard.length < 13 || cleanCard.length > 19) {
      return NextResponse.json({ error: "Numero do cartao invalido" }, { status: 400 })
    }

    if (!expiryDate || !/^\d{2}\/\d{2}$/.test(expiryDate)) {
      return NextResponse.json({ error: "Data de validade invalida (MM/AA)" }, { status: 400 })
    }

    const cleanCvv = (cvv || "").replace(/\D/g, "")
    if (!cleanCvv || cleanCvv.length < 3 || cleanCvv.length > 4) {
      return NextResponse.json({ error: "CVV invalido" }, { status: 400 })
    }

    const cleanCpf = (cpf || "").replace(/\D/g, "")
    if (!cleanCpf || cleanCpf.length !== 11) {
      return NextResponse.json({ error: "CPF invalido" }, { status: 400 })
    }

    const numAmount = Number(amount)
    if (!numAmount || numAmount < 30) {
      return NextResponse.json({ error: "Valor minimo e R$ 30,00" }, { status: 400 })
    }

    const admin = createAdminClient()

    // Create the deposit record
    const { data: deposit, error: depositError } = await admin
      .from("deposits")
      .insert({
        user_id: user.id,
        amount: numAmount,
        method: "card",
        status: "pending",
      })
      .select()
      .single()

    if (depositError) throw depositError

    // Registro do pedido de pagamento por cartao.
    //
    // IMPORTANTE: este insert tentava gravar o numero completo do cartao, a validade e o CVV em
    // texto puro. Alem de nao existirem essas colunas (o insert falhava e o deposito ficava orfao),
    // armazenar CVV e proibido pelo PCI-DSS e o numero completo exigiria certificacao. Por isso a
    // tabela guarda apenas os 4 ultimos digitos e a bandeira, que e o suficiente para o usuario e o
    // suporte identificarem o cartao. Os dados sensiveis sao usados so para validacao e descartados.
    const { error: cardError } = await admin.from("card_deposits").insert({
      user_id: user.id,
      deposit_id: deposit.id,
      holder_name: fullName.trim(),
      document: cleanCpf,
      card_last4: cleanCard.slice(-4),
      card_brand: detectCardBrand(cleanCard),
      amount: numAmount,
      status: "pending",
    })

    if (cardError) throw cardError

    return NextResponse.json({
      success: true,
      deposit: {
        id: deposit.id,
        amount: numAmount,
        status: "pending",
        method: "card",
      },
    })
  } catch (error) {
    console.error("Erro ao processar deposito via cartao:", error)
    return NextResponse.json({ error: "Erro interno ao processar deposito" }, { status: 500 })
  }
}
