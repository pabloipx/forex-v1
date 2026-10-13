import type { SupabaseClient } from "@supabase/supabase-js"
import {
  calculateCommission,
  getAffiliateSettings,
  isFirstCpaForReferral,
  resolveTerms,
  round2,
} from "@/lib/affiliate-commission"
import { grantDepositBonus } from "@/lib/promo-codes"
import { grantDepositRollover } from "@/lib/deposit-rollover"

/**
 * Aprova um deposito de forma idempotente: marca como "approved", credita o saldo do usuario,
 * registra a transacao e processa a comissao do afiliado.
 *
 * Reutilizado tanto pelo webhook da AmploPay quanto pela verificacao ativa de status (polling).
 * Retorna { approved: true } se creditou agora, ou { approved: false, alreadyProcessed: true }
 * se o deposito ja havia sido aprovado.
 */
export async function approveDeposit(
  supabaseAdmin: SupabaseClient,
  deposit: { id: string; user_id: string; amount: number; status: string; payment_reference?: string | null },
  providerTransactionId?: string,
): Promise<{ approved: boolean; alreadyProcessed?: boolean; newBalance?: number }> {
  // Idempotencia: se ja foi aprovado, nao credita de novo
  if (deposit.status === "approved") {
    return { approved: false, alreadyProcessed: true }
  }

  // 1. Marcar deposito como aprovado.
  // A coluna de data de pagamento e `paid_at`; enquanto isso era gravado como `completed_at`
  // (coluna inexistente) o Postgres recusava o update e esta funcao lancava excecao logo aqui,
  // de modo que NENHUM deposito chegava a creditar saldo.
  // O `select` no fim confirma que a linha realmente saiu de "pending": se outra execucao
  // (webhook + verificacao ativa em paralelo) tiver aprovado primeiro, nao creditamos de novo.
  const { data: updatedRows, error: updateError } = await supabaseAdmin
    .from("deposits")
    .update({
      status: "approved",
      paid_at: new Date().toISOString(),
      payment_reference: providerTransactionId || deposit.payment_reference || null,
    })
    .eq("id", deposit.id)
    .eq("status", "pending") // guarda contra corrida: so atualiza se ainda estiver pendente
    .select("id")

  if (updateError) {
    throw new Error(`Erro ao atualizar deposito: ${updateError.message}`)
  }

  // Nenhuma linha alterada = outra execucao aprovou este deposito antes. Sair sem creditar.
  if (!updatedRows || updatedRows.length === 0) {
    return { approved: false, alreadyProcessed: true }
  }

  // 2. Creditar saldo do usuario
  const { data: balance } = await supabaseAdmin
    .from("user_balances")
    .select("balance_real")
    .eq("user_id", deposit.user_id)
    .maybeSingle()

  const currentBalance = balance?.balance_real || 0
  const newBalance = currentBalance + deposit.amount

  const { error: balanceError } = await supabaseAdmin.from("user_balances").upsert(
    {
      user_id: deposit.user_id,
      balance_real: newBalance,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  )

  if (balanceError) {
    throw new Error(`Erro ao atualizar saldo: ${balanceError.message}`)
  }

  // 3. Registrar transacao
  // A tabela `transactions` nao tem coluna `status`. Enquanto ela era enviada aqui, o Postgres
  // recusava o insert inteiro (PGRST204) e, como o erro nunca era verificado, NENHUM deposito
  // aparecia no extrato — a tabela ficava vazia em silencio. As colunas corretas sao
  // balance_after, account_type e reference_id.
  const { error: txError } = await supabaseAdmin.from("transactions").insert({
    user_id: deposit.user_id,
    type: "deposit",
    amount: deposit.amount,
    balance_after: newBalance,
    account_type: "real",
    reference_id: deposit.id,
    description: "Deposito via PIX",
  })

  if (txError) {
    // Nao interrompe o deposito: o saldo ja foi creditado e o extrato e secundario.
    console.error("[v0] Erro ao registrar transacao do deposito:", txError.message)
  }

  // 4. Conceder bonus de codigo promocional, se houver.
  // Feito aqui porque este e o unico ponto de servidor por onde o deposito e creditado (webhook e
  // polling passam os dois por aqui). A funcao nunca lanca excecao e o UNIQUE em
  // user_bonuses.deposit_id garante que um webhook reenviado nao credite o bonus duas vezes.
  try {
    const { data: depositRow } = await supabaseAdmin
      .from("deposits")
      .select("promo_code")
      .eq("id", deposit.id)
      .maybeSingle()

    if (depositRow?.promo_code) {
      await grantDepositBonus(supabaseAdmin, {
        id: deposit.id,
        user_id: deposit.user_id,
        amount: deposit.amount,
        promo_code: depositRow.promo_code,
      })
    }
  } catch (bonusError) {
    console.error("[v0] Erro ao conceder bonus do deposito:", bonusError)
  }

  // 4b. Criar a trava de rollover do valor depositado, se o admin tiver ativado a regra.
  // Nao move saldo: o valor segue disponivel para operar e a trava e aplicada apenas no saque.
  // O UNIQUE em deposit_rollovers.deposit_id garante idempotencia com webhook reenviado.
  await grantDepositRollover(supabaseAdmin, {
    id: deposit.id,
    user_id: deposit.user_id,
    amount: deposit.amount,
  })

  // 5. Processar comissao do afiliado
  try {
    const { data: userProfile } = await supabaseAdmin
      .from("profiles")
      .select("referred_by")
      .eq("id", deposit.user_id)
      .single()

    if (userProfile?.referred_by) {
      const { data: affiliate } = await supabaseAdmin
        .from("profiles")
        .select(
          "id, affiliate_commission_percent, affiliate_cpa_amount, affiliate_commission_model, affiliate_cpa_min_deposit, affiliate_sub_percent, affiliate_balance, affiliate_total_earned",
        )
        .eq("affiliate_code", userProfile.referred_by)
        .eq("is_affiliate", true)
        .eq("affiliate_status", "active")
        .single()

      if (affiliate) {
        // O deposito de origem e guardado em `reference_id` (nao existe coluna `deposit_id`).
        const { data: existingCommission } = await supabaseAdmin
          .from("affiliate_commissions")
          .select("id")
          .eq("reference_id", deposit.id)
          .maybeSingle()

        if (!existingCommission) {
          const settings = await getAffiliateSettings(supabaseAdmin)

          if (settings.program_enabled) {
            const terms = resolveTerms(affiliate, settings)
            const isFirstQualifiedDeposit = await isFirstCpaForReferral(supabaseAdmin, affiliate.id, deposit.user_id)
            const breakdown = calculateCommission(deposit.amount, terms, { isFirstQualifiedDeposit })

            if (breakdown.total > 0) {
              // Nomes reais das colunas: amount / percent / type / reference_id. As versoes
              // commission_* nao existem no banco, entao a comissao NUNCA era gravada e o
              // afiliado nao recebia nada por indicacao (o erro nao era verificado).
              // O deposito gera apenas CPA. O RevShare e apurado sobre a receita liquida das
              // operacoes do indicado, em lib/affiliate-revshare.ts.
              const { error: commissionError } = await supabaseAdmin.from("affiliate_commissions").insert({
                affiliate_id: affiliate.id,
                referred_user_id: deposit.user_id,
                reference_id: deposit.id,
                type: "cpa",
                status: "approved",
                base_amount: deposit.amount,
                deposit_amount: deposit.amount,
                percent: 0,
                amount: breakdown.total,
                revshare_amount: 0,
                cpa_amount: breakdown.cpaAmount,
                level: 1,
                description: "CPA do primeiro deposito de indicado",
              })

              if (commissionError) {
                throw new Error(`Erro ao registrar comissao: ${commissionError.message}`)
              }

              await supabaseAdmin
                .from("profiles")
                .update({
                  affiliate_balance: round2((affiliate.affiliate_balance || 0) + breakdown.total),
                  affiliate_total_earned: round2((affiliate.affiliate_total_earned || 0) + breakdown.total),
                })
                .eq("id", affiliate.id)
            }
          }
        }
      }
    }
  } catch (affiliateError) {
    // Nao falha o pagamento por causa da comissao
    console.error("[v0] Erro ao processar comissao do afiliado:", affiliateError)
  }

  return { approved: true, newBalance }
}

/** Status da AmploPay que indicam pagamento confirmado */
export function isPaidStatus(status?: string): boolean {
  if (!status) return false
  const s = status.toUpperCase()
  return s === "PAID" || s === "OK" || s === "COMPLETED" || s === "APPROVED"
}

/**
 * Reconcilia depositos PIX pendentes consultando o status direto na AmploPay e creditando os
 * que ja foram pagos. E o mesmo trabalho do cron, mas extraido para ser reutilizado tambem por
 * um gatilho leve por-usuario (quando o cliente esta ativo no app), ja que o plano Hobby so
 * permite 1 execucao de cron por dia.
 *
 * Passar `userId` limita a reconciliacao aos depositos daquele usuario (uso no endpoint chamado
 * pelo proprio cliente). Sem `userId`, varre todos os pendentes recentes (uso no cron).
 *
 * So considera PIX pendente das ultimas 24h com `payment_reference` (o ID interno da AmploPay
 * necessario para consultar a cobranca).
 */
export async function reconcilePendingDeposits(
  supabaseAdmin: SupabaseClient,
  amplopay: { getTransactionStatus: (id: string) => Promise<{ id: string; status: string } | null> },
  opts: { userId?: string; limit?: number } = {},
): Promise<{ checked: number; approved: number }> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

  let query = supabaseAdmin
    .from("deposits")
    .select("id, user_id, amount, status, payment_reference")
    .eq("status", "pending")
    .eq("method", "pix")
    .not("payment_reference", "is", null)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(opts.limit ?? 50)

  if (opts.userId) {
    query = query.eq("user_id", opts.userId)
  }

  const { data: pending, error } = await query

  if (error) {
    console.error("[RECONCILE] Erro ao buscar depositos pendentes:", error.message)
    throw new Error(error.message)
  }

  let checked = 0
  let approved = 0

  for (const deposit of pending || []) {
    if (!deposit.payment_reference) continue
    checked++
    try {
      const tx = await amplopay.getTransactionStatus(deposit.payment_reference)
      if (tx && isPaidStatus(tx.status)) {
        const result = await approveDeposit(supabaseAdmin, deposit, tx.id)
        if (result.approved) {
          approved++
          console.log("[RECONCILE] Deposito aprovado automaticamente:", deposit.id)
        }
      }
    } catch (err) {
      console.error("[RECONCILE] Erro ao verificar deposito", deposit.id, err)
      // Continua verificando os demais
    }
  }

  return { checked, approved }
}
