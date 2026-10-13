/**
 * Trade Manager - SERVERLESS COMPATIBLE
 * Trades são resolvidos via API call, não via setTimeout
 */

import type { Trade } from "@/lib/types"
import { getRealPriceAt } from "@/lib/price-engine/real-quote"
import { isRealSymbol } from "@/lib/price-engine/real-price-store"
import { multiAssetEngine } from "@/lib/price-engine/multi-asset-engine"

function getSupabaseAdmin() {
  const { createClient } = require("@supabase/supabase-js")
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  const key = process.env.SUPABASE_SECRET_KEY || ""
  
  if (!url || !key) return null
  
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// O gerador sintetico de preco (`generatePriceAtTime`) foi REMOVIDO daqui.
//
// Ele produzia um preco em torno de 1.085 a partir de senos somados a um pseudo-aleatorio com
// semente no relogio, e — pior — ignorava o parametro `symbol`: BTCUSD, USDJPY e EURUSD eram
// todos abertos e liquidados sobre a mesma serie inventada de ~1.08. Como esse mesmo numero era
// usado como entry_price e exit_price, o WIN/LOSS do usuario era decidido por um valor que nao
// tinha relacao com o mercado nem com o grafico exibido na tela.
//
// Agora o preco de mercado aberto vem de `getRealPriceAt` (cotacao real + historico de ticks
// gravado). Sem preco real, a operacao nao e aberta nem liquidada — ver os metodos abaixo.

/** Preco de abertura: real no mercado aberto, motor sintetico no OTC. `null` = indisponivel. */
async function getEntryPrice(symbol: string): Promise<number | null> {
  if (isRealSymbol(symbol)) {
    return getRealPriceAt(symbol, Date.now())
  }
  // OTC segue com o motor deterministico atual, intocado e de proposito sintetico.
  const otc = multiAssetEngine.getCurrentPrice(symbol)
  return otc && otc > 0 ? otc : null
}

/** Preco de liquidacao no instante do vencimento. `null` = indisponivel (nao liquida). */
async function getExitPrice(symbol: string, expiryMs: number): Promise<number | null> {
  if (isRealSymbol(symbol)) {
    return getRealPriceAt(symbol, expiryMs)
  }
  const otc = multiAssetEngine.getCurrentPrice(symbol)
  return otc && otc > 0 ? otc : null
}

export class TradeManager {
  async openTrade(
    userId: string,
    symbol: string,
    direction: "CALL" | "PUT",
    amount: number,
    duration: number,
  ): Promise<{ success: boolean; trade?: Trade; error?: string; newBalance?: number }> {
    try {
      const supabase = getSupabaseAdmin()
      if (!supabase) {
        return { success: false, error: "Database not configured" }
      }

      const { data: balanceData, error: balanceError } = await supabase
        .from("user_balances")
        .select("balance")
        .eq("user_id", userId)
        .single()

      if (balanceError || !balanceData) {
        return { success: false, error: "Failed to fetch balance" }
      }

      if (balanceData.balance < amount) {
        return { success: false, error: "Insufficient balance" }
      }

      // Preco de entrada: real para mercado aberto, motor sintetico para OTC (que e sintetico
      // de proposito). Se um ativo de mercado aberto nao tiver preco real disponivel, a operacao
      // e recusada — abrir sobre um preco inventado tornaria a liquidacao arbitraria.
      const currentPrice = await getEntryPrice(symbol)
      if (currentPrice === null) {
        return { success: false, error: "Preco de mercado indisponivel. Tente novamente." }
      }

      const now = new Date()
      const expiryTime = new Date(now.getTime() + duration * 1000)
      const payoutPercentage = 0.96

      const newBalance = Number(balanceData.balance) - amount
      const { error: updateError } = await supabase
        .from("user_balances")
        .update({ balance: newBalance, updated_at: new Date().toISOString() })
        .eq("user_id", userId)

      if (updateError) {
        return { success: false, error: "Failed to update balance" }
      }

      const { data: tradeData, error: tradeError } = await supabase
        .from("trades")
        .insert({
          user_id: userId,
          symbol,
          direction,
          amount,
          entry_price: currentPrice,
          timeframe: duration,
          payout_percentage: payoutPercentage,
          result: "PENDING",
          expiry_time: expiryTime.toISOString(),
          entry_time: now.toISOString(),
        })
        .select()
        .single()

      if (tradeError || !tradeData) {
        await supabase.from("user_balances").update({ balance: balanceData.balance }).eq("user_id", userId)
        return { success: false, error: "Failed to create trade" }
      }

      return { success: true, trade: tradeData as Trade, newBalance }
    } catch (error) {
      console.error("Error opening trade:", error)
      return { success: false, error: "Internal error" }
    }
  }

  async resolveTrade(tradeId: string): Promise<{ success: boolean; result?: string; error?: string }> {
    try {
      const supabase = getSupabaseAdmin()
      if (!supabase) {
        return { success: false, error: "Database not configured" }
      }

      const { data: trade, error: tradeError } = await supabase
        .from("trades")
        .select("*")
        .eq("id", tradeId)
        .single()

      if (tradeError || !trade) {
        return { success: false, error: "Trade not found" }
      }

      if (trade.result !== "PENDING") {
        return { success: true, result: trade.result }
      }

      // Preco de saida no instante do VENCIMENTO (nao no instante em que a rota rodou): se a
      // resolucao atrasar, o resultado ainda tem de refletir o preco do momento em que a
      // operacao venceu.
      const expiryMs = new Date(trade.expiry_time).getTime()
      const exitPrice = await getExitPrice(trade.symbol, expiryMs)

      // Sem preco real nao ha como decidir ganho ou perda com justica. A operacao permanece
      // PENDING e sera resolvida na proxima tentativa, quando houver cotacao.
      if (exitPrice === null) {
        return { success: false, error: "Preco de mercado indisponivel para liquidar" }
      }

      const priceDiff = exitPrice - trade.entry_price

      let result: "WIN" | "LOSS"
      if (trade.direction === "CALL") {
        result = priceDiff > 0 ? "WIN" : "LOSS"
      } else {
        result = priceDiff < 0 ? "WIN" : "LOSS"
      }

      let profit = 0
      if (result === "WIN") {
        profit = trade.amount * trade.payout_percentage
      } else {
        profit = -trade.amount
      }

      // `exit_time` nao existe na tabela `trades`; o nome correto e `closed_at`. Com o nome errado
      // o Postgres recusava o update inteiro (PGRST204) e a operacao nunca era encerrada.
      await supabase
        .from("trades")
        .update({
          exit_price: exitPrice,
          result,
          profit,
          closed_at: new Date().toISOString(),
          status: "closed",
        })
        .eq("id", tradeId)

      const { data: balanceData } = await supabase
        .from("user_balances")
        .select("balance")
        .eq("user_id", trade.user_id)
        .single()

      if (balanceData) {
        const newBalance = Number(balanceData.balance) + trade.amount + profit
        await supabase
          .from("user_balances")
          .update({ balance: newBalance, updated_at: new Date().toISOString() })
          .eq("user_id", trade.user_id)
      }

      return { success: true, result }
    } catch (error) {
      console.error("Error resolving trade:", error)
      return { success: false, error: "Internal error" }
    }
  }

  async getActiveTrade(userId: string): Promise<Trade | null> {
    try {
      const supabase = getSupabaseAdmin()
      if (!supabase) return null

      const { data, error } = await supabase
        .from("trades")
        .select("*")
        .eq("user_id", userId)
        .eq("result", "PENDING")
        .order("entry_time", { ascending: false })
        .limit(1)
        .single()

      if (error || !data) return null
      return data as Trade
    } catch {
      return null
    }
  }

  async restoreActiveTrades() {
    // No-op em serverless - trades são resolvidos via API
  }
}

let tradeManagerInstance: TradeManager | null = null

export function getTradeManager(): TradeManager {
  if (!tradeManagerInstance) {
    tradeManagerInstance = new TradeManager()
  }
  return tradeManagerInstance
}
