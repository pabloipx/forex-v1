import { type NextRequest, NextResponse } from "next/server"
import { createAdminClient, createClient as createServerClient } from "@/lib/supabase/server"
import { cancelActiveBonus, getActiveBonus, shouldCancelBonusOnWithdrawal } from "@/lib/promo-codes"
import { getDepositRolloverSummary } from "@/lib/deposit-rollover"

// Mesmo minimo exibido na tela de saque.
const MIN_WITHDRAWAL = 100

/**
 * Criacao de saque no servidor.
 *
 * Antes, a tela /withdraw inseria o saque E debitava o saldo direto do navegador. Isso trazia dois
 * problemas graves:
 *   1. O valor era debitado no pedido e DE NOVO na aprovacao do admin — um saque de R$ 100 tirava
 *      R$ 200 do usuario.
 *   2. Saldo e limites eram validados apenas no cliente, ou seja, contornaveis.
 *
 * Agora o debito acontece UMA unica vez, aqui. A aprovacao apenas muda o status, e a rejeicao
 * devolve o valor.
 */
export async function POST(request: NextRequest) {
  try {
    const supabaseAuth = await createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Nao autenticado" }, { status: 401 })
    }

    const body = await request.json()
    const amount = Number(body.amount)
    const method = body.method === "crypto" ? "crypto" : "pix"
    const pixKey = typeof body.pixKey === "string" ? body.pixKey.trim() : ""
    const pixKeyType = typeof body.pixKeyType === "string" ? body.pixKeyType : "cpf"
    const cryptoType = typeof body.cryptoType === "string" ? body.cryptoType.trim().toUpperCase() : ""
    const cryptoWallet = typeof body.cryptoWallet === "string" ? body.cryptoWallet.trim() : ""
    const holderName = typeof body.holderName === "string" ? body.holderName.trim() : ""
    const document = typeof body.document === "string" ? body.document.trim() : ""

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Valor invalido" }, { status: 400 })
    }

    if (amount < MIN_WITHDRAWAL) {
      return NextResponse.json(
        { error: `O valor minimo para saque e R$ ${MIN_WITHDRAWAL.toFixed(2)}` },
        { status: 400 },
      )
    }

    // Os mesmos dados exigidos na tela sao revalidados aqui, porque a tela pode ser contornada.
    if (method === "pix" && !pixKey) {
      return NextResponse.json({ error: "Informe a chave PIX" }, { status: 400 })
    }

    if (method === "crypto" && !cryptoWallet) {
      return NextResponse.json({ error: "Informe o endereco da carteira" }, { status: 400 })
    }

    // Chave de servico: o saldo e o saque sao gravados sem depender das policies do cliente.
    const supabase = createAdminClient()

    const { data: balanceRow, error: balanceError } = await supabase
      .from("user_balances")
      .select("balance_real")
      .eq("user_id", user.id)
      .maybeSingle()

    if (balanceError) {
      return NextResponse.json({ error: "Erro ao consultar saldo" }, { status: 500 })
    }

    const balance = Number(balanceRow?.balance_real || 0)

    // TRAVA DE ROLLOVER: o valor do bonus ativo nao pode ser sacado antes de cumprir o volume.
    const activeBonus = await getActiveBonus(supabase, user.id)
    const bonusLocked = activeBonus ? Number(activeBonus.bonus_amount || 0) : 0

    // TRAVA DE ROLLOVER DE DEPOSITO: o valor depositado fica preso ate o usuario negociar
    // deposito x multiplicador em volume. Diferente do bonus, este e dinheiro do proprio
    // usuario — nunca e cancelado nem removido do saldo, apenas nao pode sair antes do volume.
    const depositRollover = await getDepositRolloverSummary(supabase, user.id)
    const depositLocked = depositRollover?.locked || 0

    // Piso absoluto: nem cancelar o bonus libera o valor presto ao rollover de deposito.
    const availableIgnoringBonus = Math.max(0, balance - depositLocked)
    const available = Math.max(0, availableIgnoringBonus - bonusLocked)

    let cancelBonus = false

    if (amount > available) {
      if (activeBonus && amount <= availableIgnoringBonus && (await shouldCancelBonusOnWithdrawal(supabase))) {
        // Politica configurada: o saque e permitido, mas custa o bonus.
        cancelBonus = true
      } else if (depositRollover && amount > availableIgnoringBonus) {
        return NextResponse.json(
          {
            error:
              `Voce ainda tem R$ ${depositLocked.toFixed(2)} em depositos travados pelo rollover. ` +
              `Faltam R$ ${depositRollover.remaining.toFixed(2)} de volume em entradas para liberar esse valor. ` +
              `Saldo disponivel para saque agora: R$ ${available.toFixed(2)}.`,
            rolloverRemaining: depositRollover.remaining,
            lockedAmount: depositLocked,
            availableBalance: available,
          },
          { status: 409 },
        )
      } else if (activeBonus) {
        const remaining = Math.max(
          0,
          Number(activeBonus.rollover_required) - Number(activeBonus.rollover_progress),
        )
        return NextResponse.json(
          {
            error:
              `Voce tem R$ ${bonusLocked.toFixed(2)} em bonus travados. Saldo disponivel para saque: ` +
              `R$ ${available.toFixed(2)}. Faltam R$ ${remaining.toFixed(2)} de volume negociado.`,
          },
          { status: 409 },
        )
      } else {
        return NextResponse.json({ error: "Saldo insuficiente" }, { status: 400 })
      }
    }

    // Cancela o bonus ANTES de checar o saldo final: o valor travado sai da conta.
    if (cancelBonus) {
      const result = await cancelActiveBonus(
        supabase,
        user.id,
        "saque solicitado antes de cumprir o rollover",
      )
      const balanceAfterCancel = Math.max(0, balance - (result.removedAmount || 0) - depositLocked)

      if (amount > balanceAfterCancel) {
        return NextResponse.json(
          {
            error:
              `Bonus cancelado pelo saque. Saldo restante: R$ ${balanceAfterCancel.toFixed(2)}, ` +
              `insuficiente para sacar R$ ${amount.toFixed(2)}.`,
          },
          { status: 409 },
        )
      }
    }

    // Releitura do saldo: se o bonus foi cancelado, o valor mudou.
    const { data: freshBalance } = await supabase
      .from("user_balances")
      .select("balance_real")
      .eq("user_id", user.id)
      .maybeSingle()

    const currentBalance = Number(freshBalance?.balance_real || 0)

    // O valor preso ao rollover de deposito segue fora do que pode sair, mesmo depois do
    // cancelamento do bonus.
    if (amount > Math.max(0, currentBalance - depositLocked)) {
      return NextResponse.json({ error: "Saldo insuficiente" }, { status: 400 })
    }

    const { data: withdrawal, error: insertError } = await supabase
      .from("withdrawals")
      .insert({
        user_id: user.id,
        amount,
        status: "pending",
        method,
        pix_key: method === "pix" ? pixKey : null,
        pix_key_type: method === "pix" ? pixKeyType : null,
        crypto_type: method === "crypto" ? cryptoType : null,
        crypto_wallet: method === "crypto" ? cryptoWallet : null,
        holder_name: holderName || null,
        document: document || null,
      })
      .select("id")
      .single()

    if (insertError || !withdrawal) {
      return NextResponse.json(
        { error: "Erro ao registrar saque: " + (insertError?.message || "desconhecido") },
        { status: 500 },
      )
    }

    // Debito unico do saldo. O valor fica reservado enquanto o saque esta pendente; se o admin
    // rejeitar, e devolvido.
    const newBalance = Math.round((currentBalance - amount) * 100) / 100

    const { error: debitError } = await supabase
      .from("user_balances")
      .update({ balance_real: newBalance, updated_at: new Date().toISOString() })
      .eq("user_id", user.id)

    if (debitError) {
      // Nao deixa o saque pendente sem o debito correspondente.
      await supabase.from("withdrawals").delete().eq("id", withdrawal.id)
      return NextResponse.json({ error: "Erro ao debitar saldo" }, { status: 500 })
    }

    await supabase.from("transactions").insert({
      user_id: user.id,
      type: "withdrawal",
      amount: -amount,
      balance_after: newBalance,
      account_type: "real",
      reference_id: withdrawal.id,
      description: method === "crypto" ? `Solicitacao de saque via ${cryptoType}` : "Solicitacao de saque via PIX",
    })

    return NextResponse.json({
      success: true,
      withdrawalId: withdrawal.id,
      newBalance,
      bonusCancelled: cancelBonus,
    })
  } catch (error) {
    console.error("[v0] Erro na rota de saque:", error)
    return NextResponse.json({ error: "Erro interno ao processar saque" }, { status: 500 })
  }
}
