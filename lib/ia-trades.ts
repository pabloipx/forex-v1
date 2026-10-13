// Entradas do Robô de IA gravadas como operações reais em `trades` (aparecem no histórico da tela de TRADE).
// Compartilhado entre o acerto da IA (/api/iabroker/state) e os ajustes do admin (/api/admin/data).

const AI_TRADE_SYMBOLS: { symbol: string; price: number }[] = [
  { symbol: "EURUSD_OTC", price: 1.0857 },
  { symbol: "GBPUSD_OTC", price: 1.2712 },
  { symbol: "USDJPY_OTC", price: 156.82 },
  { symbol: "AUDUSD_OTC", price: 0.6634 },
  { symbol: "BTCUSD_OTC", price: 64231 },
]
const AI_TIMEFRAMES = [60, 300, 600]

export const IA_MIN_ENTRY = 1
export const IA_PAYOUT = 0.96

const round2 = (n: number) => Math.round(n * 100) / 100
const roundPrice = (p: number) => (p >= 1000 ? Math.round(p * 100) / 100 : Math.round(p * 100000) / 100000)

// Entrada que fecha exatamente com o resultado pedido (positivo = ganho, negativo = perda).
export const iaEntryForResult = (result: number): { amount: number; profit: number } =>
  result >= 0
    ? { amount: Math.max(IA_MIN_ENTRY, round2(result / IA_PAYOUT)), profit: round2(result) }
    : { amount: Math.max(IA_MIN_ENTRY, round2(-result)), profit: round2(result) }

export function buildAiTradeRow(userId: string, amount: number, profit: number, offsetIndex: number) {
  const s = AI_TRADE_SYMBOLS[Math.floor(Math.random() * AI_TRADE_SYMBOLS.length)]
  const direction: "CALL" | "PUT" = Math.random() < 0.5 ? "CALL" : "PUT"
  // O app inteiro (tela de TRADE, histórico) usa result em minúsculo: "win"/"loss".
  const result: "win" | "loss" = profit >= 0 ? "win" : "loss"
  const win = result === "win"
  const up = direction === "CALL"
  const delta = s.price * (0.0004 + Math.random() * 0.0006)
  const entryPrice = s.price
  const exitPrice = win === up ? entryPrice + delta : entryPrice - delta
  const timeframe = AI_TIMEFRAMES[Math.floor(Math.random() * AI_TIMEFRAMES.length)]
  // Espaça as entradas emitidas no mesmo ciclo para não terem o mesmo horário.
  const now = Date.now() - offsetIndex * 90_000
  return {
    user_id: userId,
    symbol: s.symbol,
    direction,
    amount: round2(amount),
    entry_price: roundPrice(entryPrice),
    exit_price: roundPrice(exitPrice),
    timeframe,
    payout_percentage: IA_PAYOUT,
    result,
    profit: round2(profit),
    status: "closed",
    is_demo: false,
    entry_time: new Date(now - timeframe * 1000).toISOString(),
    expiry_time: new Date(now).toISOString(),
    closed_at: new Date(now).toISOString(),
  }
}
