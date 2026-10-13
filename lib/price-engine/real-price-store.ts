/**
 * Store SINCRONO e compartilhado para precos REAIS de mercado (ex.: BTC via Coinbase).
 *
 * E um modulo puro (apenas um Map em memoria) — sem fetch, sem efeitos colaterais — por isso
 * pode ser importado com seguranca tanto no servidor quanto no cliente e, principalmente,
 * dentro do motor de precos deterministico (multi-asset-engine), que le daqui de forma
 * sincrona a cada frame. Quem PREENCHE este store e o real-price-feed (client), que faz o
 * polling da API real e escreve os valores aqui.
 */

export interface RealCandle {
  time: number
  open: number
  high: number
  low: number
  close: number
}

interface Entry {
  price: number
  priceTs: number
  candles: Map<number, RealCandle[]> // timeframe(s) -> candles (ordem crescente)
  revision: number
}

const store = new Map<string, Entry>()

export interface RealFeedInfo {
  /** Simbolo no Yahoo Finance (ex.: "BTC-USD", "EURUSD=X") */
  product: string
  decimals: number
}

// Simbolos internos do motor (mercado aberto) que devem usar feed REAL.
// As versoes OTC (ex.: "BTCUSD_OTC") continuam sinteticas de proposito.
// Todos possuem velas OHLC reais no Yahoo Finance, inclusive os pares de forex.
export const REAL_FEED_SYMBOLS: Record<string, RealFeedInfo> = {
  BTCUSD: { product: "BTC-USD", decimals: 2 },
  EURUSD: { product: "EURUSD=X", decimals: 5 },
  GBPJPY: { product: "GBPJPY=X", decimals: 3 },
  EURJPY: { product: "EURJPY=X", decimals: 3 },
  AUDUSD: { product: "AUDUSD=X", decimals: 5 },
  AUDJPY: { product: "AUDJPY=X", decimals: 3 },
  // Majors reais adicionais
  GBPUSD: { product: "GBPUSD=X", decimals: 5 },
  USDJPY: { product: "USDJPY=X", decimals: 3 },
  USDCHF: { product: "USDCHF=X", decimals: 5 },
  USDCAD: { product: "USDCAD=X", decimals: 5 },
  NZDUSD: { product: "NZDUSD=X", decimals: 5 },
  EURGBP: { product: "EURGBP=X", decimals: 5 },
}

export function isRealSymbol(symbol: string): boolean {
  return !!REAL_FEED_SYMBOLS[symbol]
}

function ensure(symbol: string): Entry {
  let e = store.get(symbol)
  if (!e) {
    e = { price: 0, priceTs: 0, candles: new Map(), revision: 0 }
    store.set(symbol, e)
  }
  return e
}

export function setRealPrice(symbol: string, price: number): void {
  const e = ensure(symbol)
  e.price = price
  e.priceTs = Date.now()
  e.revision++
}

export function setRealCandles(symbol: string, tf: number, candles: RealCandle[]): void {
  const e = ensure(symbol)
  const prev = e.candles.get(tf)

  if (prev?.length && candles.length) {
    // O historico recarrega a cada 15s, enquanto os ticks chegam a cada 600ms. Substituir a
    // lista inteira jogaria fora o trabalho dos ticks nas velas que a fonte ainda nao
    // consolidou. Duas protecoes:

    // 1) Velas mais recentes que o historico do servidor sao mantidas na integra — elas so
    //    existem porque os ticks as construiram.
    const lastServer = candles[candles.length - 1].time
    const live = prev.filter(c => c.time > lastServer)
    if (live.length) candles = [...candles, ...live]

    // 2) Nas velas que APARECEM nas duas listas, os extremos observados por tick nunca sao
    //    reduzidos. Sem isto, a cada 15s o high/low de uma vela encolhia para o valor achatado
    //    da fonte (que no forex vem com high == low) e o grafico "perdia" pavios reais que ja
    //    havia desenhado — a vela piscava e mudava de forma sozinha.
    const byTime = new Map(prev.map(c => [c.time, c]))
    candles = candles.map(c => {
      const old = byTime.get(c.time)
      if (!old) return c
      return {
        ...c,
        high: Math.max(c.high, old.high),
        low: Math.min(c.low, old.low),
      }
    })
  }

  e.candles.set(tf, candles)
  e.revision++
}

const MAX_REAL_CANDLES = 400

/**
 * Registra um TICK real na vela em formacao. E o nucleo do motor de mercado aberto.
 *
 * Regras de formacao, iguais as de uma corretora:
 *   - a vela do periodo corrente e ATUALIZADA, nunca recriada nem substituida;
 *   - High sobe quando o tick supera a maxima; Low desce quando fica abaixo da minima;
 *   - Close e sempre o ultimo tick recebido;
 *   - ao virar o periodo, a vela nova abre no fechamento da anterior (Open = close anterior).
 *
 * Todos os valores sao precos reais de mercado: nada aqui e gerado.
 */
export function pushRealTick(symbol: string, tf: number, price: number, decimals: number): void {
  const e = ensure(symbol)
  const arr = e.candles.get(tf) || []
  const bucket = Math.floor(Date.now() / 1000 / tf) * tf
  const r = (n: number) => Number(n.toFixed(decimals))
  const last = arr[arr.length - 1]

  // Sem historico ainda: NAO cria uma vela solta. O preco chega em ~80ms e o historico em
  // ~300ms; semear uma vela aqui deixava a serie com um unico ponto, e o grafico desenhava
  // essa vela sozinha encostada na borda esquerda em vez do historico. A vela em formacao
  // ja e exibida por getCurrentCandle enquanto o historico nao chega.
  if (!last) return

  if (last.time < bucket) {
    const open = last.close

    // O historico do servidor pode terminar alguns periodos atras (a fonte publica atrasa
    // alguns minutos). Sem preencher esse intervalo, a vela nova nasceria distante da ultima
    // e o grafico abriria um vao. Cada periodo vago vira uma vela de continuidade no ultimo
    // fechamento real conhecido: nao houve preco novo ali, logo nao houve movimento.
    for (let t = last.time + tf; t < bucket; t += tf) {
      arr.push({ time: t, open: last.close, high: last.close, low: last.close, close: last.close })
    }

    arr.push({ time: bucket, open, high: Math.max(open, r(price)), low: Math.min(open, r(price)), close: r(price) })
    while (arr.length > MAX_REAL_CANDLES) arr.shift()
  } else if (last.time === bucket) {
    last.high = Math.max(last.high, r(price))
    last.low = Math.min(last.low, r(price))
    last.close = r(price)
  }
  e.candles.set(tf, arr)
  e.revision++
}

export function getRealPrice(symbol: string): number {
  return store.get(symbol)?.price || 0
}

// Considera o preco "fresco" apenas se recebido nos ultimos 30s (evita usar dado velho se o
// feed cair — nesse caso o motor volta ao sintetico).
export function hasRealPrice(symbol: string): boolean {
  const e = store.get(symbol)
  return !!e && e.price > 0 && Date.now() - e.priceTs < 30000
}

export function getRealCandles(symbol: string, tf: number): RealCandle[] | null {
  return store.get(symbol)?.candles.get(tf) || null
}

export function getRealRevision(symbol: string): number {
  return store.get(symbol)?.revision || 0
}
