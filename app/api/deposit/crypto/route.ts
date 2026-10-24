import { createClient, createAdminClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

import { CRYPTO_MIN_USD, CRYPTO_OPTIONS, USD_TO_BRL, isCryptoType } from "@/lib/deposit/crypto"
import { getUsdBrlRate } from "@/lib/fx"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })
    }

    // O valor em reais NAO e aceito do cliente: ele e sempre recalculado no servidor a partir do
    // valor em dolar. Antes o corpo da requisicao podia enviar amountBrl livremente, entao um
    // deposito de US$ 20 podia ser registrado como R$ 999.999 e creditado nesse valor na aprovacao.
    const { amountUsd, txHash, cryptoType } = await request.json()

    if (!isCryptoType(cryptoType)) {
      return NextResponse.json({ error: "Criptomoeda invalida" }, { status: 400 })
    }
    const crypto = CRYPTO_OPTIONS[cryptoType]

    // Validations
    const numAmount = Number(amountUsd)
    if (!numAmount || numAmount < CRYPTO_MIN_USD) {
      return NextResponse.json({ error: `Valor minimo e $${CRYPTO_MIN_USD} USD` }, { status: 400 })
    }

    if (typeof txHash !== "string" || txHash.trim().length < 10 || txHash.trim().length > 200) {
      return NextResponse.json({ error: "Hash da transacao invalido" }, { status: 400 })
    }

    const cleanTxHash = txHash.trim()

    const admin = createAdminClient()

    // Check if this tx hash was already used
    // maybeSingle: com `single()` a ausencia de registro (caso normal) e tratada como erro pelo
    // PostgREST, poluindo o log a cada deposito novo.
    const { data: existingDeposit } = await admin
      .from("deposits")
      .select("id")
      .eq("external_id", cleanTxHash)
      .maybeSingle()

    if (existingDeposit) {
      return NextResponse.json({ error: "Esta transacao ja foi registrada" }, { status: 400 })
    }

    // O saldo da corretora e em dolar: o deposito cripto credita exatamente o valor em USD.
    // O equivalente em reais e so informativo, pela cotacao ao vivo (com fallback fixo).
    let brlRate = USD_TO_BRL
    try {
      brlRate = (await getUsdBrlRate()).rate
    } catch {}
    const amountBrl = Math.round(numAmount * brlRate * 100) / 100

    // Create the deposit record
    const { data: deposit, error: depositError } = await admin
      .from("deposits")
      .insert({
        user_id: user.id,
        amount: numAmount,
        currency: "USD",
        method: "crypto",
        status: "pending",
        external_id: cleanTxHash,
        payment_details: {
          type: "crypto",
          currency: crypto.symbol,
          network: crypto.network,
          amount_usd: numAmount,
          amount_brl: amountBrl,
          fx_rate: brlRate,
          tx_hash: cleanTxHash,
          wallet_address: crypto.wallet,
        },
      })
      .select()
      .single()

    if (depositError) throw depositError

    return NextResponse.json({
      success: true,
      deposit: {
        id: deposit.id,
        amount_usd: numAmount,
        amount_brl: amountBrl,
        status: "pending",
        method: "crypto",
      },
    })
  } catch (error) {
    console.error("Erro ao processar deposito cripto:", error)
    return NextResponse.json({ error: "Erro interno ao processar deposito" }, { status: 500 })
  }
}
