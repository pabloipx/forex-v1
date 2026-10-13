/**
 * Lista todos os ativos com o preco corrente.
 *
 * Duas origens, conforme a natureza do ativo:
 *  - OTC: motor sintetico deterministico (multiAssetEngine), inalterado.
 *  - Mercado aberto: ultimo preco REAL gravado pelo historico de ticks. O feed de precos roda
 *    no navegador, entao no servidor o store esta vazio; sem isto os ativos reais caiam no
 *    gerador sintetico e a lista mostrava um numero diferente do grafico.
 */

import { OTC_ASSETS, multiAssetEngine } from "@/lib/price-engine/multi-asset-engine"
import { isRealSymbol } from "@/lib/price-engine/real-price-store"
import { getRecordedSnapshots } from "@/lib/price-engine/tick-recorder"

export const dynamic = "force-dynamic"

export async function GET() {
  const realSymbols = OTC_ASSETS.filter((a) => isRealSymbol(a.symbol)).map((a) => a.symbol)
  const snapshots = await getRecordedSnapshots(realSymbols).catch(
    () => new Map<string, { price: number; first: number }>(),
  )

  const prices: Record<string, { price: number; change: number }> = {}

  for (const asset of OTC_ASSETS) {
    if (isRealSymbol(asset.symbol)) {
      const snap = snapshots.get(asset.symbol)
      if (!snap) {
        // Sem tick gravado ainda (ativo nunca aberto desde o ultimo deploy, ou mercado
        // fechado). Preco 0 sinaliza "sem cotacao" — nada e inventado no lugar.
        prices[asset.symbol] = { price: 0, change: 0 }
        continue
      }
      // Variacao real: do primeiro fechamento da janela ate o ultimo preco recebido.
      const change = snap.first > 0 ? ((snap.price - snap.first) / snap.first) * 100 : 0
      prices[asset.symbol] = {
        price: Number(snap.price.toFixed(asset.decimals)),
        change: Number(change.toFixed(2)),
      }
      continue
    }

    const currentPrice = multiAssetEngine.getCurrentPrice(asset.symbol)
    const change = ((currentPrice - asset.basePrice) / asset.basePrice) * 100
    prices[asset.symbol] = {
      price: currentPrice,
      change: Number(change.toFixed(2)),
    }
  }

  return Response.json({
    assets: OTC_ASSETS.map((a) => ({
      symbol: a.symbol,
      name: a.name,
      icon: a.icon,
      basePrice: a.basePrice,
    })),
    prices,
    timestamp: Date.now(),
  })
}
