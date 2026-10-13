/**
 * Price Manager - SERVERLESS COMPATIBLE
 * Coordina geração de preços para múltiplos símbolos
 * NÃO usa setInterval - calcula preços sob demanda
 */

import type { OTCSymbol } from "@/lib/types"

interface SymbolConfig {
  symbol: string
  basePrice: number
  volatility: number
}

export interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
}

// Função para gerar número pseudo-aleatório determinístico
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + seed * 78.233) * 43758.5453123
  return x - Math.floor(x)
}

export class PriceManager {
  private symbols: Map<string, SymbolConfig> = new Map()
  private maxCandles = 200

  initialize(otcSymbols: OTCSymbol[]) {
    for (const symbol of otcSymbols) {
      if (!symbol.is_active) continue
      this.symbols.set(symbol.symbol, {
        symbol: symbol.symbol,
        basePrice: symbol.base_price,
        volatility: symbol.volatility,
      })
    }
  }

  // Gera preço baseado no timestamp e símbolo - determinístico
  private generatePriceAtTime(symbolConfig: SymbolConfig, timestamp: number): number {
    const { basePrice, volatility, symbol } = symbolConfig
    const symbolSeed = symbol.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
    const seed = timestamp + symbolSeed

    const microCycle = seededRandom(seed) * volatility * 2 - volatility
    const shortCycle = Math.sin(seed * 0.01) * volatility * 3
    const mediumCycle = Math.sin(seed * 0.001) * volatility * 5

    const deviation = microCycle + shortCycle + mediumCycle
    const maxDev = basePrice * 0.008 // 0.8% máximo

    const price = basePrice + deviation
    return Number(
      Math.max(basePrice - maxDev, Math.min(basePrice + maxDev, price)).toFixed(5)
    )
  }

  private generateCandle(symbolConfig: SymbolConfig, startTime: number, timeframe: number): Candle {
    const prices: number[] = []
    for (let i = 0; i < timeframe * 2; i++) {
      const tickTime = startTime + i * 0.5
      prices.push(this.generatePriceAtTime(symbolConfig, Math.floor(tickTime)))
    }

    return {
      time: startTime,
      open: prices[0],
      high: Math.max(...prices),
      low: Math.min(...prices),
      close: prices[prices.length - 1],
    }
  }

  getCurrentPrice(symbol: string): number | null {
    const config = this.symbols.get(symbol)
    if (!config) return null
    return this.generatePriceAtTime(config, Math.floor(Date.now() / 1000))
  }

  getHistoricalCandles(symbol: string, timeframe: 60 | 300 | 600 | 900): Candle[] {
    const config = this.symbols.get(symbol)
    if (!config) return []

    const now = Math.floor(Date.now() / 1000)
    const currentCandleStart = Math.floor(now / timeframe) * timeframe
    const candles: Candle[] = []

    for (let i = this.maxCandles; i > 0; i--) {
      const candleStart = currentCandleStart - i * timeframe
      candles.push(this.generateCandle(config, candleStart, timeframe))
    }

    return candles
  }

  getCurrentCandle(symbol: string, timeframe: 60 | 300 | 600 | 900): Candle | null {
    const config = this.symbols.get(symbol)
    if (!config) return null

    const now = Math.floor(Date.now() / 1000)
    const candleStart = Math.floor(now / timeframe) * timeframe
    const elapsed = now - candleStart

    const prices: number[] = []
    for (let i = 0; i <= elapsed * 2; i++) {
      prices.push(this.generatePriceAtTime(config, candleStart + i * 0.5))
    }

    if (prices.length === 0) {
      prices.push(this.generatePriceAtTime(config, candleStart))
    }

    return {
      time: candleStart,
      open: prices[0],
      high: Math.max(...prices),
      low: Math.min(...prices),
      close: prices[prices.length - 1],
    }
  }

  // Métodos vazios para compatibilidade
  start() {}
  stop() {}
  subscribe(_callback: (data: any) => void) {
    return () => {}
  }
  broadcast(_data: any) {}
}

let priceManagerInstance: PriceManager | null = null

export function getPriceManager(): PriceManager {
  if (!priceManagerInstance) {
    priceManagerInstance = new PriceManager()
  }
  return priceManagerInstance
}
