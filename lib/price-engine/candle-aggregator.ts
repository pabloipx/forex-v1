/**
 * Candle Aggregator
 * Aggregates tick data into OHLC candles for different timeframes
 * Supports 1M (60s), 5M (300s), and 10M (600s) only
 */

export interface Candle {
  time: number // Unix timestamp (start of candle)
  open: number
  high: number
  low: number
  close: number
}

interface CandleBuilder {
  startTime: number
  open: number
  high: number
  low: number
  close: number
  ticks: number
}

export class CandleAggregator {
  private symbol: string
  private timeframe: 60 | 300 | 600 | 900
  private currentCandle: CandleBuilder | null = null
  private completedCandles: Candle[] = []
  private maxCandles = 100

  constructor(symbol: string, timeframe: 60 | 300 | 600 | 900) {
    this.symbol = symbol
    this.timeframe = timeframe
  }

  /**
   * Add a new tick to the aggregator
   * Returns completed candle if timeframe window closed
   */
  addTick(price: number, timestamp: number): Candle | null {
    const candleStartTime = this.getCandleStartTime(timestamp)

    // Initialize new candle if needed
    if (!this.currentCandle || this.currentCandle.startTime !== candleStartTime) {
      // Save previous candle if it exists
      const completedCandle = this.currentCandle ? this.finalizeCandle() : null

      // Start new candle
      this.currentCandle = {
        startTime: candleStartTime,
        open: price,
        high: price,
        low: price,
        close: price,
        ticks: 1,
      }

      return completedCandle
    }

    // Update current candle
    this.currentCandle.high = Math.max(this.currentCandle.high, price)
    this.currentCandle.low = Math.min(this.currentCandle.low, price)
    this.currentCandle.close = price
    this.currentCandle.ticks++

    return null
  }

  /**
   * Get current incomplete candle for live updates
   */
  getCurrentCandle(): Candle | null {
    if (!this.currentCandle) return null

    return {
      time: this.currentCandle.startTime,
      open: this.currentCandle.open,
      high: this.currentCandle.high,
      low: this.currentCandle.low,
      close: this.currentCandle.close,
    }
  }

  /**
   * Get all completed candles
   */
  getCompletedCandles(): Candle[] {
    return [...this.completedCandles]
  }

  private getCandleStartTime(timestamp: number): number {
    // Round down to nearest timeframe interval
    return Math.floor(timestamp / this.timeframe) * this.timeframe
  }

  private finalizeCandle(): Candle | null {
    if (!this.currentCandle) return null

    const candle: Candle = {
      time: this.currentCandle.startTime,
      open: this.currentCandle.open,
      high: this.currentCandle.high,
      low: this.currentCandle.low,
      close: this.currentCandle.close,
    }

    // Store in history
    this.completedCandles.push(candle)

    // Keep only last N candles
    if (this.completedCandles.length > this.maxCandles) {
      this.completedCandles.shift()
    }

    return candle
  }

  getTimeframe(): number {
    return this.timeframe
  }

  getSymbol(): string {
    return this.symbol
  }
}
