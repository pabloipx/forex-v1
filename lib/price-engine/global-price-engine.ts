/**
 * GLOBAL OTC Price Engine - SERVERLESS COMPATIBLE
 * Motor de preços realista estilo IQ Option / Quotex
 * Movimentos determinísticos baseados em timestamp
 * NÃO usa setInterval - calcula preços sob demanda
 */

export interface GlobalCandle {
  time: number
  open: number
  high: number
  low: number
  close: number
}

// Função para gerar número pseudo-aleatório determinístico baseado em seed
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + seed * 78.233) * 43758.5453123
  return x - Math.floor(x)
}

class GlobalPriceEngine {
  private static instance: GlobalPriceEngine | null = null
  private basePrice = 1.085
  private maxCandles = 200

  private constructor() {}

  static getInstance(): GlobalPriceEngine {
    if (!GlobalPriceEngine.instance) {
      GlobalPriceEngine.instance = new GlobalPriceEngine()
    }
    return GlobalPriceEngine.instance
  }

  // Gera preço baseado no timestamp - determinístico e stateless
  private generatePriceAtTime(timestamp: number): number {
    const seed = timestamp
    
    // Componentes de preço baseados em diferentes ciclos
    const microCycle = seededRandom(seed) * 0.0001 - 0.00005
    const shortCycle = Math.sin(seed * 0.01) * 0.0003
    const mediumCycle = Math.sin(seed * 0.001) * 0.0005
    const longCycle = Math.sin(seed * 0.0001) * 0.001
    
    // Combina os ciclos
    const deviation = microCycle + shortCycle + mediumCycle + longCycle
    
    // Aplica mean reversion
    const price = this.basePrice + deviation
    
    // Limita desvio máximo (0.8%)
    const maxDev = this.basePrice * 0.008
    const clampedPrice = Math.max(
      this.basePrice - maxDev,
      Math.min(this.basePrice + maxDev, price)
    )
    
    return Number(clampedPrice.toFixed(5))
  }

  // Gera candle para um período específico
  private generateCandle(startTime: number, timeframe: number): GlobalCandle {
    const ticksInCandle = timeframe * 2 // 2 ticks por segundo
    const prices: number[] = []
    
    for (let i = 0; i < ticksInCandle; i++) {
      const tickTime = startTime + (i * 0.5)
      prices.push(this.generatePriceAtTime(Math.floor(tickTime)))
    }
    
    return {
      time: startTime,
      open: prices[0],
      high: Math.max(...prices),
      low: Math.min(...prices),
      close: prices[prices.length - 1],
    }
  }

  getCurrentPrice(): number {
    const now = Math.floor(Date.now() / 1000)
    return this.generatePriceAtTime(now)
  }

  getCandles(timeframe: 60 | 300 | 600 | 900): GlobalCandle[] {
    const now = Math.floor(Date.now() / 1000)
    const candles: GlobalCandle[] = []
    const currentCandleStart = Math.floor(now / timeframe) * timeframe
    
    // Gera candles históricos
    for (let i = this.maxCandles; i > 0; i--) {
      const candleStart = currentCandleStart - (i * timeframe)
      candles.push(this.generateCandle(candleStart, timeframe))
    }
    
    return candles
  }

  getCurrentCandle(timeframe: 60 | 300 | 600 | 900): GlobalCandle | null {
    const now = Math.floor(Date.now() / 1000)
    const candleStart = Math.floor(now / timeframe) * timeframe
    const elapsed = now - candleStart
    
    // Gera candle parcial com ticks até agora
    const prices: number[] = []
    for (let i = 0; i <= elapsed * 2; i++) {
      const tickTime = candleStart + (i * 0.5)
      prices.push(this.generatePriceAtTime(Math.floor(tickTime)))
    }
    
    if (prices.length === 0) {
      prices.push(this.generatePriceAtTime(candleStart))
    }
    
    return {
      time: candleStart,
      open: prices[0],
      high: Math.max(...prices),
      low: Math.min(...prices),
      close: prices[prices.length - 1],
    }
  }

  getLastTickTime(): number {
    return Math.floor(Date.now() / 1000)
  }

  isEngineRunning(): boolean {
    return true // Sempre "rodando" - é stateless
  }

  getGlobalState(timeframe: 60 | 300 | 600 | 900) {
    return {
      symbol: "OTC_EURUSD",
      price: this.getCurrentPrice(),
      timestamp: this.getLastTickTime(),
      candles: this.getCandles(timeframe),
      currentCandle: this.getCurrentCandle(timeframe),
      timeframe,
    }
  }

  // Métodos vazios para compatibilidade
  start() {}
  stop() {}
}

export const globalPriceEngine = GlobalPriceEngine.getInstance()

export function getGlobalPriceEngine(): GlobalPriceEngine {
  return GlobalPriceEngine.getInstance()
}
