export interface PriceAnchor {
  time: number
  value: number
}

export interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export const TIMEFRAMES = [
  { id: "1m", label: "1m", seconds: 60 },
  { id: "5m", label: "5m", seconds: 300 },
  { id: "15m", label: "15m", seconds: 900 },
  { id: "1h", label: "1h", seconds: 3600 },
  { id: "4h", label: "4h", seconds: 14400 },
] as const

export type TimeframeId = (typeof TIMEFRAMES)[number]["id"]

const CANDLE_COUNT = 240
const MEMORY = 24
const DECAY = 0.88

function hashString(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function unit(seed: number, t: number, salt: number): number {
  let x = (seed ^ Math.imul(t | 0, 0x9e3779b1) ^ Math.imul(salt, 0x85ebca6b)) >>> 0
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d)
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b)
  x ^= x >>> 16
  return ((x >>> 0) + 0.5) / 4294967296
}

function gauss(seed: number, t: number, salt: number): number {
  const u = unit(seed, t, salt)
  const v = unit(seed, t, salt + 7919)
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

function priceAt(anchors: PriceAnchor[], t: number): number {
  let value = anchors[0].value
  for (const a of anchors) {
    if (a.time > t) break
    value = a.value
  }
  return value
}

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Builds deterministic, market-looking candles that follow the admin-set price.
 * The same bucket always renders the same candle, so refreshes don't reshuffle
 * history, and the forming candle always closes at the real tradable price.
 */
export function buildCandles(anchors: PriceAnchor[], symbol: string, intervalSec: number, nowSec: number): Candle[] {
  if (anchors.length === 0) return []
  const sorted = [...anchors].sort((a, b) => a.time - b.time)
  const seed = hashString(`${symbol}:${intervalSec}`)
  const sigma = (0.0024 * Math.sqrt(intervalSec / 60)) / 2.1
  const lastBucket = Math.floor(nowSec / intervalSec) * intervalSec

  const noiseAt = (t: number) => {
    let sum = 0
    let w = 1
    for (let k = 0; k < MEMORY; k++) {
      sum += w * gauss(seed, t / intervalSec - k, 1)
      w *= DECAY
    }
    return sum * sigma
  }

  const candles: Candle[] = []
  let prevClose: number | null = null
  for (let i = CANDLE_COUNT - 1; i >= 0; i--) {
    const t = lastBucket - i * intervalSec
    const idx = t / intervalSec
    const target = priceAt(sorted, t + intervalSec - 1)
    const isLast = i === 0
    const close = isLast ? target : target * (1 + noiseAt(t))
    const open = prevClose ?? close * (1 + gauss(seed, idx, 3) * sigma)
    const wickUp = Math.abs(gauss(seed, idx, 5)) * sigma * 0.9
    const wickDown = Math.abs(gauss(seed, idx, 9)) * sigma * 0.9
    const high = Math.max(open, close) * (1 + wickUp)
    const low = Math.min(open, close) * (1 - wickDown)
    const move = Math.abs(close - open) / open
    const volume = (40 + unit(seed, idx, 11) * 120) * (1 + move * 60) * Math.sqrt(intervalSec / 60)

    candles.push({
      time: t,
      open: round2(open),
      high: round2(high),
      low: round2(low),
      close: round2(close),
      volume: Math.round(volume),
    })
    prevClose = close
  }
  return candles
}
