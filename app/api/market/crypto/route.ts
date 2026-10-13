import { NextResponse } from "next/server"
import { recordTick, getRecordedCandles } from "@/lib/price-engine/tick-recorder"
import {
  SYMBOLS,
  round,
  getLivePrice,
  fetchTradingViewPrice,
  fetchTwelveDataCandles,
  type SymbolInfo as RealSymbolInfo,
  type RealCandle,
} from "@/lib/price-engine/real-quote"

// Proxy para dados REAIS de mercado. Roda no servidor para evitar CORS e o bloqueio
// geografico que afeta algumas exchanges (ex.: Binance) a partir da Vercel.
//
// Duas fontes, cada uma no que faz melhor:
//
// 1) PRECO AO VIVO -> scanner do proprio TradingView. E a cotacao que o TradingView
//    exibe, com 5 casas decimais e em modo "streaming". Testado: o Yahoo entrega o
//    forex arredondado em 4 casas (ex.: 1.1535 no lugar de 1.15322) e congelado por
//    minutos, o que travava as velas e empatava as operacoes curtas.
//
// 2) HISTORICO DE VELAS -> Yahoo Finance, que devolve o OHLC real por periodo.
//    O scanner do TradingView so expoe o snapshot atual, sem historico.
export const dynamic = "force-dynamic"

// O mapa de simbolos, o arredondamento e a busca de preco vivem em lib/price-engine/real-quote
// para que a LIQUIDACAO das operacoes use exatamente a mesma cotacao que alimenta o grafico.
// Duas copias divergiriam com o tempo e o usuario seria pago por um preco diferente do que viu.
type SymbolInfo = RealSymbolInfo

/**
 * O Yahoo so tem OHLC real de 1m para cripto. Para forex ele devolve o minuto achatado
 * (open=high=low=close), entao nesses pares as velas de 1m sao montadas com os ticks
 * reais que a plataforma acumula.
 */
function hasRealYahoo1m(info: SymbolInfo): boolean {
  return info.tvScan === "crypto"
}

// RealCandle vive em lib/price-engine/real-quote e e reexportado para nao quebrar quem importa
// o tipo desta rota.
export type { RealCandle }

// =============================================
// HISTORICO DE VELAS (Yahoo Finance)
// =============================================

/**
 * O Yahoo aceita 1m, 2m, 5m, 15m, 30m, 60m. Buscamos o maior intervalo que divide o
 * timeframe pedido e agregamos, para que 10m (que o Yahoo nao tem) seja montado a
 * partir de velas reais de 5m em vez de cair silenciosamente em 1m.
 */
function sourceIntervalFor(tf: number): { interval: string; seconds: number } {
  if (tf % 900 === 0) return { interval: "15m", seconds: 900 }
  if (tf % 300 === 0) return { interval: "5m", seconds: 300 }
  return { interval: "1m", seconds: 60 }
}

// Velas de 1m so ficam disponiveis nos ultimos dias; o range acompanha o intervalo.
function rangeFor(interval: string): string {
  return interval === "1m" ? "1d" : "1mo"
}

async function fetchYahooChart(symbol: string, interval: string, range: string) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol,
  )}?interval=${interval}&range=${range}`

  // O Yahoo rejeita requisicoes sem User-Agent de navegador
  const r = await fetch(url, {
    cache: "no-store",
    headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" },
  })
  if (!r.ok) throw new Error(`yahoo ${r.status}`)

  const j = await r.json()
  const result = j?.chart?.result?.[0]
  if (!result) throw new Error("resposta sem resultado")
  return result
}

/** Converte a resposta do Yahoo em velas OHLC, descartando os buckets vazios */
function parseCandles(result: any): RealCandle[] {
  const timestamps: number[] = result?.timestamp ?? []
  const quote = result?.indicators?.quote?.[0]
  if (!quote) return []

  const candles: RealCandle[] = []
  for (let i = 0; i < timestamps.length; i++) {
    const open = quote.open?.[i]
    const high = quote.high?.[i]
    const low = quote.low?.[i]
    const close = quote.close?.[i]
    // O Yahoo devolve null nos minutos sem negociacao
    if (
      !Number.isFinite(open) ||
      !Number.isFinite(high) ||
      !Number.isFinite(low) ||
      !Number.isFinite(close)
    ) {
      continue
    }
    candles.push({ time: timestamps[i], open, high, low, close })
  }
  return candles
}

/**
 * Monta as velas de 1m do forex combinando as duas fontes reais disponiveis.
 *
 * As duas fontes NAO tem a mesma qualidade, e essa e a chave da funcao:
 *
 *  - Ticks OANDA (gravados pela plataforma): cotacao negociavel, 5 casas decimais, com
 *    maxima/minima realmente observadas no minuto. E o dado BOM — mas so existe nos minutos
 *    em que havia alguem usando a plataforma.
 *  - Yahoo: tem a linha do tempo completa (um ponto por minuto), porem com taxa indicativa
 *    arredondada em 4 casas e o minuto achatado (open=high=low=close em 100% dos casos).
 *
 * Por isso o tick tem PRIORIDADE e o Yahoo e apenas preenchimento. Antes as duas eram tratadas
 * como equivalentes: onde o Yahoo tinha um ponto, o fechamento dele vencia e apagava o tick de
 * 5 casas do mesmo minuto (1.15567 virava 1.1558), achatando 150 das 240 velas.
 *
 * Resultado: serie continua, sem vaos, sempre com o melhor dado real disponivel em cada minuto.
 */
function buildMinuteCandles(
  yahoo: RealCandle[],
  recorded: RealCandle[],
  decimals: number,
): RealCandle[] {
  const byBucket = new Map<number, RealCandle>()
  for (const c of recorded) byBucket.set(c.time, c)

  // Minutos conhecidos: os do Yahoo mais os ticks recentes (o Yahoo atrasa alguns minutos).
  const minutes = new Set<number>()
  for (const c of yahoo) minutes.add(Math.floor(c.time / 60) * 60)
  for (const c of recorded) minutes.add(c.time)
  if (!minutes.size) return []

  const yahooClose = new Map<number, number>()
  for (const c of yahoo) yahooClose.set(Math.floor(c.time / 60) * 60, c.close)

  const sorted = Array.from(minutes).sort((a, b) => a - b)
  const last = sorted[sorted.length - 1]

  // Janela limitada aos minutos que o grafico realmente mostra. Sem isso, um historico de
  // ticks antigo (ex.: da sexta) faria a serie varrer todo o fim de semana minuto a minuto,
  // enchendo o grafico de velas planas de mercado fechado.
  const first = Math.max(sorted[0], last - 239 * 60)

  const out: RealCandle[] = []
  let prevClose = byBucket.get(first)?.open ?? yahooClose.get(first) ?? 0

  // Percorre minuto a minuto para nao deixar buracos: um minuto sem dado nenhum vira uma
  // vela de continuidade no ultimo preco real conhecido (nao houve preco novo observado).
  for (let t = first; t <= last; t += 60) {
    const tick = byBucket.get(t)

    if (tick) {
      // Minuto com tick real: usado integralmente. O open encadeia no fechamento anterior e o
      // corpo/extremos vem do que foi efetivamente observado no mercado.
      const open = prevClose || tick.open
      out.push({
        time: t,
        open: round(open, decimals),
        high: round(Math.max(tick.high, open, tick.close), decimals),
        low: round(Math.min(tick.low, open, tick.close), decimals),
        close: round(tick.close, decimals),
      })
      prevClose = tick.close
      continue
    }

    // Sem tick: cai no Yahoo (ou na continuidade). Sem maxima/minima observadas, a vela fica
    // limitada ao proprio corpo — nao ha pavio a inventar.
    const close = yahooClose.get(t) ?? prevClose
    const open = prevClose || close
    out.push({
      time: t,
      open: round(open, decimals),
      high: round(Math.max(open, close), decimals),
      low: round(Math.min(open, close), decimals),
      close: round(close, decimals),
    })
    prevClose = close
  }

  return out
}

/**
 * Preenche buracos CURTOS na serie. O Yahoo devolve null em periodos sem negociacao e isso
 * aparece no grafico como vao. Um periodo vago vira vela de continuidade no ultimo fechamento
 * real: nao houve preco novo, logo nao houve movimento. O OHLC real e sempre preservado.
 *
 * Buracos longos NAO sao preenchidos de proposito: o fim de semana do forex e uma parada real
 * de mercado, e enche-lo de velas planas inventaria dezenas de horas de "mercado parado" e
 * ainda pesaria no grafico. O limite separa a falha pontual da fonte do mercado fechado.
 */
const MAX_GAP_FILL = 3

function fillGaps(candles: RealCandle[], tf: number): RealCandle[] {
  if (candles.length < 2) return candles

  const out: RealCandle[] = [candles[0]]
  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1]
    const missing = Math.round((candles[i].time - prev.time) / tf) - 1
    if (missing > 0 && missing <= MAX_GAP_FILL) {
      for (let t = prev.time + tf; t < candles[i].time; t += tf) {
        out.push({ time: t, open: prev.close, high: prev.close, low: prev.close, close: prev.close })
      }
    }
    out.push(candles[i])
  }
  return out
}

/** Agrupa velas menores no timeframe pedido, preservando o OHLC real do periodo */
function aggregate(candles: RealCandle[], tf: number): RealCandle[] {
  const byBucket = new Map<number, RealCandle>()
  // As velas vem em ordem crescente, entao o ultimo close do bucket e o fechamento
  for (const c of candles) {
    const bucket = Math.floor(c.time / tf) * tf
    const existing = byBucket.get(bucket)
    if (!existing) {
      byBucket.set(bucket, { time: bucket, open: c.open, high: c.high, low: c.low, close: c.close })
    } else {
      existing.high = Math.max(existing.high, c.high)
      existing.low = Math.min(existing.low, c.low)
      existing.close = c.close
    }
  }
  return Array.from(byBucket.values()).sort((a, b) => a.time - b.time)
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const symbol = searchParams.get("symbol") || "BTCUSD"
  const info = SYMBOLS[symbol]
  const type = searchParams.get("type") || "price"

  if (!info) {
    return NextResponse.json({ error: "symbol_unsupported" }, { status: 400 })
  }

  try {
    if (type === "price") {
      // getLivePrice ja arredonda e faz o cache de 1s por simbolo, compartilhado com a
      // liquidacao das operacoes: grafico e resultado sempre leem a MESMA cotacao.
      const live = await getLivePrice(symbol)
      if (live !== null) {
        recordTick(symbol, live)
        return NextResponse.json({ price: live })
      }

      // A fonte principal falhou. Cai no meta do Yahoo para manter o ativo negociavel.
      let price: number
      try {
        price = await fetchTradingViewPrice(info)
      } catch {
        // Reserva: o meta do Yahoo. Menos preciso, mas mantem o ativo negociavel
        // se o scanner do TradingView estiver fora do ar.
        const result = await fetchYahooChart(info.yahoo, "1m", "1d")
        price = Number(result?.meta?.regularMarketPrice)
        if (!Number.isFinite(price)) {
          const candles = parseCandles(result)
          price = candles.length ? candles[candles.length - 1].close : Number.NaN
        }
      }
      if (!Number.isFinite(price) || price <= 0) throw new Error("preco invalido")

      price = round(price, info.decimals)

      // Alimenta o historico de 1m com este preco real. Nao usa await de proposito:
      // a cotacao do usuario nao pode esperar (nem falhar por causa da) gravacao.
      recordTick(symbol, price)

      return NextResponse.json({ price })
    }

    // type === "candles"
    const tf = Math.max(60, Number(searchParams.get("tf") || 60))

    // FONTE PRIMARIA: OHLC real da Twelve Data.
    //
    // O Yahoo (usado abaixo como reserva) devolve o forex de 1m com open=high=low=close em 100%
    // das velas — medido: 1242 de 1242. Sem maxima e minima do intervalo nao existe pavio nem
    // corpo, e era essa a razao de o grafico nao ficar igual ao do mercado real mesmo com o
    // preco ao vivo correto. A Twelve Data entrega o intervalo agregado de verdade.
    const td = await fetchTwelveDataCandles(symbol, tf)
    if (td) {
      // O 10m nao existe na fonte: vem em 5min e e agregado aqui, preservando o OHLC do periodo.
      const candles = aggregate(td, tf)
      if (candles.length >= 2) {
        return NextResponse.json({ candles: candles.slice(-240), source: "twelvedata" })
      }
    }

    // Forex em 1m: combina a linha do tempo do Yahoo (continua, com o fechamento real de
    // cada minuto) com o corpo dos ticks observados. Sozinha, nenhuma das duas serve: o
    // Yahoo vem achatado e os ticks vem com vaos.
    if (tf === 60 && !hasRealYahoo1m(info)) {
      const [yahoo, recorded] = await Promise.all([
        fetchYahooChart(info.yahoo, "1m", "1d").then(parseCandles).catch(() => [] as RealCandle[]),
        getRecordedCandles(symbol).catch(() => [] as RealCandle[]),
      ])

      const merged = buildMinuteCandles(yahoo, recorded, info.decimals)
      if (merged.length >= 2) {
        return NextResponse.json({ candles: merged.slice(-240), source: "merged" })
      }
    }

    const { interval } = sourceIntervalFor(tf)
    const result = await fetchYahooChart(info.yahoo, interval, rangeFor(interval))
    // Sempre agrega, mesmo quando o intervalo da fonte ja e o pedido: alem de agrupar, o
    // aggregate alinha os periodos e junta duplicatas. O Yahoo devolve a ultima vela (a do
    // periodo em formacao) com timestamp fora da grade, o que aparecia no grafico como um
    // vao e uma vela comprimida na borda.
    let candles = aggregate(parseCandles(result), tf)
    candles = fillGaps(candles, tf)

    if (!candles.length) throw new Error("sem velas")

    // O Yahoo devolve float32 alargado (64256.01171875); a UI espera a precisao do par.
    const rounded = candles.map(c => ({
      time: c.time,
      open: round(c.open, info.decimals),
      high: round(c.high, info.decimals),
      low: round(c.low, info.decimals),
      close: round(c.close, info.decimals),
    }))
    return NextResponse.json({ candles: rounded })
  } catch (e) {
    console.log("[v0] market feed erro:", symbol, (e as Error).message)
    return NextResponse.json({ error: "feed_unavailable" }, { status: 502 })
  }
}
