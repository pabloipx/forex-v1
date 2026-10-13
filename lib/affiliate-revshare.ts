import type { SupabaseClient } from "@supabase/supabase-js"
import { getAffiliateSettings, resolveTerms, round2, type AffiliateGlobalSettings } from "./affiliate-commission"

/**
 * RevShare sobre a receita liquida das operacoes.
 *
 * Antes o RevShare era calculado sobre o valor do DEPOSITO, o que nao refletia o resultado real
 * da casa: o afiliado recebia o mesmo independente de o indicado ganhar ou perder. Agora o
 * RevShare acompanha o que a casa efetivamente lucra com o indicado.
 *
 * Receita liquida da casa em uma operacao encerrada:
 *   - o indicado perde  -> a casa ganha o valor apostado
 *   - o indicado ganha  -> a casa perde o lucro pago
 *
 * Na tabela `trades` a coluna `profit` ja guarda o resultado do ponto de vista do JOGADOR
 * (positivo quando ele ganha, negativo quando perde), entao a receita da casa e simplesmente
 * `-profit`. Isso evita depender de `result` ter uma grafia especifica.
 *
 * ## Por que por MES e nao por operacao
 *
 * Pagar um percentual a cada operacao perdida, sem descontar as ganhas, faria o afiliado receber
 * muito mais do que a casa arrecadou (um indicado que perde 100 e depois ganha 100 geraria
 * comissao mesmo com receita zero). O padrao de mercado e apurar a receita LIQUIDA por periodo.
 *
 * Apuramos por mes calendario e mantemos UMA linha de comissao por (afiliado, indicado, mes),
 * recalculada conforme novas operacoes sao encerradas. Como o calculo sempre parte do total do
 * mes e apenas ajusta a linha existente, rodar esta funcao varias vezes nao duplica valores.
 *
 * ## Quando roda
 *
 * E chamada quando o painel do afiliado ou o painel admin le os dados. Nao depende do navegador
 * do jogador: a liquidacao da operacao acontece no cliente, que usa a chave publica e nao teria
 * permissao para creditar comissao a outra conta. Por isso a apuracao e feita no servidor, a
 * partir das operacoes ja gravadas.
 */

const MONEY_EPSILON = 0.005

/** Chave do mes calendario (UTC) usada para agrupar a apuracao, ex: "2026-08". */
function monthKey(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
}

/** Texto gravado em `description`. Serve tambem de chave para reencontrar a linha do mes. */
function monthDescription(month: string): string {
  return `RevShare de operacoes - ${month}`
}

export interface RevshareAccrualResult {
  /** Quanto o saldo do afiliado variou nesta apuracao (pode ser negativo). */
  delta: number
  /** Meses que foram criados ou atualizados. */
  monthsTouched: string[]
}

interface AffiliateProfile {
  id: string
  affiliate_code: string | null
  affiliate_balance: number | null
  affiliate_total_earned: number | null
  affiliate_commission_percent?: number | null
  affiliate_cpa_amount?: number | null
  affiliate_commission_model?: string | null
  affiliate_cpa_min_deposit?: number | null
  affiliate_sub_percent?: number | null
}

/**
 * Reapura o RevShare de operacoes de um afiliado.
 *
 * Exige um cliente com service role: le operacoes de outros usuarios e escreve em `profiles`.
 * Nunca lanca excecao — em caso de falha registra no log e devolve delta zero, para nao derrubar
 * a leitura do painel.
 */
export async function accrueTradeRevshare(
  supabaseAdmin: SupabaseClient,
  affiliate: AffiliateProfile,
  settingsOverride?: AffiliateGlobalSettings,
): Promise<RevshareAccrualResult> {
  const empty: RevshareAccrualResult = { delta: 0, monthsTouched: [] }

  try {
    if (!affiliate?.id || !affiliate.affiliate_code) return empty

    const settings = settingsOverride ?? (await getAffiliateSettings(supabaseAdmin))
    if (!settings.program_enabled) return empty

    const terms = resolveTerms(affiliate, settings)
    // Modelo "cpa" puro nao tem RevShare.
    if (terms.model !== "revshare" && terms.model !== "hybrid") return empty
    if (terms.revsharePercent <= 0) return empty

    // Indicados deste afiliado.
    const { data: referrals } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("referred_by", affiliate.affiliate_code)

    if (!referrals?.length) return empty
    const referralIds = referrals.map((r) => r.id)

    // Operacoes encerradas de dinheiro real. `profit` nulo significa que a operacao ainda nao
    // foi liquidada, entao nao entra na apuracao.
    const { data: trades, error: tradesError } = await supabaseAdmin
      .from("trades")
      .select("id, user_id, profit, created_at, closed_at")
      .in("user_id", referralIds)
      .eq("is_demo", false)
      .not("profit", "is", null)

    if (tradesError) {
      console.error("[v0] RevShare: falha ao ler operacoes:", tradesError.message)
      return empty
    }
    if (!trades?.length) return empty

    // Receita liquida da casa por (indicado, mes).
    const netByBucket = new Map<string, { referredUserId: string; month: string; net: number }>()

    for (const trade of trades) {
      const month = monthKey(trade.closed_at || trade.created_at)
      const key = `${trade.user_id}|${month}`
      const houseRevenue = -Number(trade.profit || 0)

      const bucket = netByBucket.get(key)
      if (bucket) bucket.net += houseRevenue
      else netByBucket.set(key, { referredUserId: trade.user_id, month, net: houseRevenue })
    }

    // Linhas de RevShare de operacoes ja existentes, para atualizar em vez de duplicar.
    const { data: existingRows } = await supabaseAdmin
      .from("affiliate_commissions")
      .select("id, referred_user_id, description, amount")
      .eq("affiliate_id", affiliate.id)
      .eq("type", "revshare_trades")

    const existingByBucket = new Map<string, { id: string; amount: number }>()
    for (const row of existingRows ?? []) {
      existingByBucket.set(`${row.referred_user_id}|${row.description}`, {
        id: row.id,
        amount: Number(row.amount || 0),
      })
    }

    let delta = 0
    const monthsTouched: string[] = []

    for (const bucket of netByBucket.values()) {
      // Mes em que a casa ficou no negativo nao gera comissao (e tambem nao gera divida
      // para o afiliado: o piso e zero).
      const due = round2(Math.max(bucket.net, 0) * (terms.revsharePercent / 100))
      const description = monthDescription(bucket.month)
      const existing = existingByBucket.get(`${bucket.referredUserId}|${description}`)
      const alreadyPaid = existing?.amount ?? 0

      if (Math.abs(due - alreadyPaid) < MONEY_EPSILON) continue

      if (existing) {
        const { error } = await supabaseAdmin
          .from("affiliate_commissions")
          .update({
            amount: due,
            revshare_amount: due,
            base_amount: round2(Math.max(bucket.net, 0)),
            percent: terms.revsharePercent,
          })
          .eq("id", existing.id)

        if (error) {
          console.error("[v0] RevShare: falha ao atualizar comissao:", error.message)
          continue
        }
      } else {
        // Nao cria linha zerada: sem valor devido nao ha o que registrar.
        if (due < MONEY_EPSILON) continue

        const { error } = await supabaseAdmin.from("affiliate_commissions").insert({
          affiliate_id: affiliate.id,
          referred_user_id: bucket.referredUserId,
          // `reference_id` fica nulo de proposito: a linha resume um mes inteiro de operacoes,
          // nao uma unica operacao. O par (indicado, description) e a chave de idempotencia.
          reference_id: null,
          type: "revshare_trades",
          status: "approved",
          base_amount: round2(Math.max(bucket.net, 0)),
          percent: terms.revsharePercent,
          amount: due,
          revshare_amount: due,
          cpa_amount: 0,
          level: 1,
          description,
        })

        if (error) {
          console.error("[v0] RevShare: falha ao registrar comissao:", error.message)
          continue
        }
      }

      delta += due - alreadyPaid
      monthsTouched.push(bucket.month)
    }

    delta = round2(delta)
    if (Math.abs(delta) < MONEY_EPSILON) return { delta: 0, monthsTouched }

    // Ajusta o saldo pela diferenca. `affiliate_total_earned` so sobe, para nao "desfazer"
    // historico de ganhos quando um mes e revisado para baixo.
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({
        affiliate_balance: round2(Math.max((affiliate.affiliate_balance || 0) + delta, 0)),
        affiliate_total_earned: round2((affiliate.affiliate_total_earned || 0) + Math.max(delta, 0)),
      })
      .eq("id", affiliate.id)

    if (profileError) {
      console.error("[v0] RevShare: falha ao atualizar saldo do afiliado:", profileError.message)
      return empty
    }

    return { delta, monthsTouched }
  } catch (error) {
    console.error("[v0] RevShare: erro inesperado na apuracao:", error)
    return empty
  }
}

/** Reapura o RevShare de todos os afiliados ativos. Usado pelo painel admin. */
export async function accrueTradeRevshareForAll(supabaseAdmin: SupabaseClient): Promise<void> {
  try {
    const settings = await getAffiliateSettings(supabaseAdmin)
    if (!settings.program_enabled) return

    const { data: affiliates } = await supabaseAdmin
      .from("profiles")
      .select(
        "id, affiliate_code, affiliate_balance, affiliate_total_earned, affiliate_commission_percent, affiliate_cpa_amount, affiliate_commission_model, affiliate_cpa_min_deposit, affiliate_sub_percent",
      )
      .eq("is_affiliate", true)
      .eq("affiliate_status", "active")

    for (const affiliate of affiliates ?? []) {
      await accrueTradeRevshare(supabaseAdmin, affiliate, settings)
    }
  } catch (error) {
    console.error("[v0] RevShare: erro ao reapurar todos os afiliados:", error)
  }
}
