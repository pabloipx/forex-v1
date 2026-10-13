/**
 * Cotacao REAL de mercado no servidor. Fonte unica de verdade para o grafico e, principalmente,
 * para a LIQUIDACAO das operacoes de mercado aberto.
 *
 * Por que este modulo existe: a liquidacao usava `generatePriceAtTime()`, que sintetizava um
 * preco em torno de 1.085 a partir de senos e de um pseudo-aleatorio com semente no relogio —
 * e ignorava o simbolo, entao BTCUSD, USDJPY e EURUSD eram todos liquidados na mesma serie
 * inventada de ~1.08. O ganho/perda do usuario nao tinha relacao nem com o mercado nem com o
 * grafico que ele estava vendo.
 *
 * Aqui nada e sintetizado. O preco vem da fonte de mercado (OANDA/Coinbase via TradingView) e,
 * quando ela nao responde, do historico de ticks reais que a propria plataforma gravou. Se
 * nenhuma das duas tiver preco, a funcao devolve `null` — e quem chama deve se recusar a
 * liquidar, em vez de inventar um numero.
 */

import { createAdminClient } from "@/lib/supabase/admin"

export interface SymbolInfo {
  /** Simbolo no Yahoo Finance, usado como reserva do historico de velas */
  yahoo: string
  /** Simbolo na Twelve Data, fonte primaria do OHLC real (ver fetchTwelveDataCandles) */
  td: string
  /** Ticker no TradingView, usado no preco ao vivo */
  tv: string
  /** Mercado do scanner do TradingView */
  tvScan: "forex" | "crypto"
  /** Casas decimais do par. O Yahoo devolve float32 alargado (1.1531364917755127). */
  decimals: number
}

/**
 * Mapa dos ativos de mercado aberto -> simbolos das fontes reais.
 *
 * A fonte de forex e OANDA, e nao FX_IDC. FX_IDC e uma fonte de REFERENCIA (taxa indicativa,
 * nao negociada): medida aqui, devolve o EUR/USD com 4 casas decimais e congelado — 1 unico
 * valor em 12 leituras, ou seja, 0 pip de variacao. Com preco parado e sem a casa do pip, as
 * velas nasciam sem corpo e as operacoes curtas empatavam.
 *
 * OANDA e uma corretora de verdade: cotacao negociavel com 5 casas decimais (1.15542, a mesma
 * precisao do TradingView) e movimento real — na mesma medicao, 8 pips de amplitude em 60s.
 */
export const SYMBOLS: Record<string, SymbolInfo> = {
  BTCUSD: { yahoo: "BTC-USD", td: "BTC/USD", tv: "COINBASE:BTCUSD", tvScan: "crypto", decimals: 2 },
  EURUSD: { yahoo: "EURUSD=X", td: "EUR/USD", tv: "OANDA:EURUSD", tvScan: "forex", decimals: 5 },
  GBPJPY: { yahoo: "GBPJPY=X", td: "GBP/JPY", tv: "OANDA:GBPJPY", tvScan: "forex", decimals: 3 },
  EURJPY: { yahoo: "EURJPY=X", td: "EUR/JPY", tv: "OANDA:EURJPY", tvScan: "forex", decimals: 3 },
  AUDUSD: { yahoo: "AUDUSD=X", td: "AUD/USD", tv: "OANDA:AUDUSD", tvScan: "forex", decimals: 5 },
  AUDJPY: { yahoo: "AUDJPY=X", td: "AUD/JPY", tv: "OANDA:AUDJPY", tvScan: "forex", decimals: 3 },
  GBPUSD: { yahoo: "GBPUSD=X", td: "GBP/USD", tv: "OANDA:GBPUSD", tvScan: "forex", decimals: 5 },
  USDJPY: { yahoo: "USDJPY=X", td: "USD/JPY", tv: "OANDA:USDJPY", tvScan: "forex", decimals: 3 },
  USDCHF: { yahoo: "USDCHF=X", td: "USD/CHF", tv: "OANDA:USDCHF", tvScan: "forex", decimals: 5 },
  USDCAD: { yahoo: "USDCAD=X", td: "USD/CAD", tv: "OANDA:USDCAD", tvScan: "forex", decimals: 5 },
  NZDUSD: { yahoo: "NZDUSD=X", td: "NZD/USD", tv: "OANDA:NZDUSD", tvScan: "forex", decimals: 5 },
  EURGBP: { yahoo: "EURGBP=X", td: "EUR/GBP", tv: "OANDA:EURGBP", tvScan: "forex", decimals: 5 },
}

/** Arredonda para a precisao real do par, removendo o ruido de ponto flutuante do Yahoo. */
export function round(value: number, decimals: number): number {
  return Number(value.toFixed(decimals))
}

export interface RealCandle {
  time: number
  open: number
  high: number
  low: number
  close: number
}

// =============================================
// OHLC REAL (Twelve Data)
// =============================================

/**
 * Fonte PRIMARIA do OHLC de mercado aberto.
 *
 * Por que trocar o Yahoo: medido nesta base, o Yahoo devolve o forex de 1m com
 * open=high=low=close em 1242 de 1242 velas — 100% achatado. Velas sem maxima e sem minima nao
 * tem pavio nem corpo, e e exatamente por isso que o grafico nunca ficava igual ao do mercado
 * real, por mais que o preco ao vivo estivesse correto. O Yahoo publica uma taxa indicativa
 * amostrada uma vez por minuto, nao o intervalo negociado.
 *
 * A Twelve Data devolve o OHLC agregado de verdade (0 velas achatadas na mesma medicao, 5 casas
 * decimais), que e o mesmo tipo de dado que o TradingView desenha.
 *
 * Requer TWELVE_DATA_API_KEY. Sem a chave a funcao devolve `null` e o chamador cai no Yahoo:
 * o grafico continua funcionando, apenas menos fiel.
 */
const TD_INTERVALS: Record<number, { interval: string; seconds: number }> = {
  60: { interval: "1min", seconds: 60 },
  300: { interval: "5min", seconds: 300 },
  // A Twelve Data nao tem 10min: pedimos 5min e agregamos, preservando o OHLC real.
  600: { interval: "5min", seconds: 300 },
  900: { interval: "15min", seconds: 900 },
}

// Cache do OHLC por (simbolo, intervalo), compartilhado por todos os usuarios.
//
// Sem ele o plano gratuito quebra na hora: o limite e de 8 requisicoes por minuto, e cada
// cliente com o grafico aberto recarrega velas a cada poucos segundos. Com o cache a fonte e
// consultada no maximo uma vez por intervalo, independente de haver 1 ou 10.000 usuarios.
//
// O TTL nao reduz a fidelidade: quem move a vela em formacao a cada segundo e o fluxo ao vivo
// (WebSocket), nao esta busca. Aqui so precisamos das velas JA FECHADAS, que por definicao nao
// mudam mais.
//
// 120s e o que faz os 12 pares caberem na cota: 12 requisicoes a cada 2 minutos = 6 por minuto,
// abaixo do limite de 8. Com 45s dariam 16 por minuto e 5 pares ficavam presos na reserva.
const CANDLE_TTL_MS = 120_000
const candleCache = new Map<string, { candles: RealCandle[]; at: number }>()

// Controle de vazao (limite do plano: 8 requisicoes por minuto).
//
// Medido nesta base: pedir os 12 pares em rajada estoura a cota e a fonte passa a responder
// 200 com {status:"error"}. Os 6 primeiros pares voltaram com OHLC real e os 6 seguintes caiam
// calados na reserva achatada — exatamente a falha que o usuario veria ao trocar de ativo rapido.
//
// Trabalhamos com 7 para deixar folga para o /price (cotacao ao vivo) usar a mesma cota.
const TD_MAX_PER_MIN = 7
const TD_WINDOW_MS = 60_000
let tdCalls: number[] = []

/** Consome uma vaga da janela. Devolve false se a cota do minuto ja acabou. */
function takeRateSlot(): boolean {
  const now = Date.now()
  tdCalls = tdCalls.filter((t) => now - t < TD_WINDOW_MS)
  if (tdCalls.length >= TD_MAX_PER_MIN) return false
  tdCalls.push(now)
  return true
}

/** Quanto falta para a vaga mais antiga sair da janela e liberar espaco. */
function msUntilSlot(): number {
  const now = Date.now()
  const ativos = tdCalls.filter((t) => now - t < TD_WINDOW_MS).sort((a, b) => a - b)
  if (ativos.length < TD_MAX_PER_MIN) return 0
  return TD_WINDOW_MS - (now - ativos[0]) + 250 // folga para o relogio do servidor
}

/**
 * Espera por uma vaga, ate o teto. Usado na PRIMEIRA carga de um par, quando nao existe cache
 * para servir: melhor entregar o OHLC real alguns segundos depois do que entregar de imediato a
 * serie achatada da reserva, que e justamente o defeito que estamos corrigindo.
 */
const TD_MAX_WAIT_MS = 20_000
async function waitForRateSlot(): Promise<boolean> {
  if (takeRateSlot()) return true
  const espera = msUntilSlot()
  if (espera > TD_MAX_WAIT_MS) return false
  await new Promise((r) => setTimeout(r, espera))
  return takeRateSlot()
}

// Une chamadas simultaneas do mesmo (simbolo, intervalo) numa unica ida a rede. Sem isso, varios
// clientes abrindo o mesmo par no mesmo instante gastariam uma requisicao cada.
const inflight = new Map<string, Promise<RealCandle[] | null>>()

// =============================================
// AQUECEDOR DE CACHE
// =============================================
//
// Por que existe: com 11 pares de forex, atender cada cliente na hora nao cabe na cota. Medido,
// com as requisicoes disputando a fonte entre si, 4 pares ficavam presos na reserva achatada
// mesmo com a chave configurada — e fazer o cliente esperar a vaga levaria ~60s no pior caso.
//
// Aqui invertemos o fluxo: um unico laco de fundo renova o cache de cada par em uso, espacado
// para respeitar a cota. As requisicoes dos clientes passam a apenas LER o cache, e por isso
// respondem na hora e sempre com OHLC real.
type Demand = { symbol: string; spec: { interval: string; seconds: number }; at: number }
const demand = new Map<string, Demand>()

// 9s entre renovacoes = ~6,6 por minuto, abaixo do limite de 8. Um ciclo completo de 11 pares
// leva ~99s, dentro do TTL de 120s: o cache nunca vence enquanto o par estiver em uso.
const WARM_EVERY_MS = 9_000
// Para de renovar um par que ninguem abre ha 10 min, liberando cota para os que estao em uso.
const DEMAND_TTL_MS = 600_000

let warmTimer: ReturnType<typeof setInterval> | null = null

function startWarmer() {
  if (warmTimer) return
  warmTimer = setInterval(warmTick, WARM_EVERY_MS)
  // Nao segura o processo vivo por causa deste laco (ambiente Node).
  ;(warmTimer as any).unref?.()
}

/** Renova o par em uso cujo cache esta mais velho. Uma requisicao por tique, no maximo. */
function warmTick() {
  const agora = Date.now()

  let alvo: { key: string; d: Demand } | null = null
  let maisVelho = Number.POSITIVE_INFINITY
  for (const [key, d] of demand) {
    if (agora - d.at > DEMAND_TTL_MS) {
      demand.delete(key)
      continue
    }
    // Sem cache tem prioridade maxima; depois, o cache mais antigo.
    const idade = candleCache.get(key)?.at ?? 0
    if (idade < maisVelho) {
      maisVelho = idade
      alvo = { key, d }
    }
  }

  if (!alvo) {
    // Ninguem usando: encerra o laco e economiza cota. Volta a subir na proxima requisicao.
    if (warmTimer) clearInterval(warmTimer)
    warmTimer = null
    return
  }

  // Ja esta fresco o suficiente: nao gasta a cota.
  if (agora - maisVelho < CANDLE_TTL_MS / 2) return
  if (inflight.has(alvo.key)) return

  const key = process.env.TWELVE_DATA_API_KEY
  const info = SYMBOLS[alvo.d.symbol]
  if (!key || !info) return

  const task = fetchFresh(alvo.key, alvo.d.symbol, info, alvo.d.spec, key, candleCache.get(alvo.key))
    .catch(() => null)
    .finally(() => inflight.delete(alvo!.key))
  inflight.set(alvo.key, task)
}

export function fetchTwelveDataCandles(
  symbol: string,
  tf: number,
): Promise<RealCandle[] | null> {
  const info = SYMBOLS[symbol]
  const spec = TD_INTERVALS[tf]
  const key = process.env.TWELVE_DATA_API_KEY
  if (!info || !spec || !key) return Promise.resolve(null)

  const cacheKey = `${symbol}:${spec.interval}`

  // Marca o par como "em uso" e garante que o aquecedor esteja rodando. E ele que mantem o cache
  // quente dentro da cota, para que as requisicoes dos clientes leiam cache em vez de disputar a
  // fonte entre si.
  demand.set(cacheKey, { symbol, spec, at: Date.now() })
  startWarmer()

  const hit = candleCache.get(cacheKey)
  if (hit && Date.now() - hit.at < CANDLE_TTL_MS) return Promise.resolve(hit.candles)

  const running = inflight.get(cacheKey)
  if (running) return running

  const task = fetchFresh(cacheKey, symbol, info, spec, key, hit).finally(() => {
    inflight.delete(cacheKey)
  })
  inflight.set(cacheKey, task)
  return task
}

async function fetchFresh(
  cacheKey: string,
  symbol: string,
  info: SymbolInfo,
  spec: { interval: string; seconds: number },
  key: string,
  hit: { candles: RealCandle[]; at: number } | undefined,
): Promise<RealCandle[] | null> {
  // Ja temos OHLC real deste par, so vencido: serve na hora em vez de gastar a cota. Velas
  // fechadas nao mudam, entao o unico "atraso" e na vela em formacao, que o fluxo ao vivo corrige.
  if (hit) {
    if (!takeRateSlot()) return hit.candles
  } else {
    // Primeira carga deste par: nao ha nada para servir, entao vale esperar uma vaga. Devolver
    // null aqui jogaria o grafico na reserva achatada, que e o defeito que estamos corrigindo.
    if (!(await waitForRateSlot())) {
      console.log("[v0] twelvedata sem vaga na cota:", symbol, spec.interval)
      return null
    }
  }

  try {
    // outputsize cobre as ~240 velas que o grafico mostra mesmo quando o tf pedido exige
    // agregacao (600s = 2 velas de 5min por periodo).
    const url =
      `https://api.twelvedata.com/time_series?symbol=${encodeURIComponent(info.td)}` +
      `&interval=${spec.interval}&outputsize=500&timezone=UTC&apikey=${key}`

    const r = await fetch(url, { cache: "no-store", headers: { "User-Agent": "Mozilla/5.0" } })
    if (!r.ok) throw new Error(`twelvedata ${r.status}`)

    const j = await r.json()
    // A API responde 200 com {status:"error"} em limite excedido e chave invalida.
    if (j?.status === "error") throw new Error(String(j?.message).slice(0, 120))

    const values: any[] = j?.values ?? []
    const candles: RealCandle[] = []
    for (const v of values) {
      const open = Number(v.open)
      const high = Number(v.high)
      const low = Number(v.low)
      const close = Number(v.close)
      // "2026-08-06 05:40:00" em UTC (timezone=UTC acima). O "T"/"Z" evita que o Node
      // interprete como hora local do servidor e desloque a serie inteira.
      const time = Math.floor(new Date(`${String(v.datetime).replace(" ", "T")}Z`).getTime() / 1000)
      if (![open, high, low, close, time].every(Number.isFinite)) continue
      candles.push({
        time,
        open: round(open, info.decimals),
        high: round(high, info.decimals),
        low: round(low, info.decimals),
        close: round(close, info.decimals),
      })
    }
    if (candles.length < 2) throw new Error("resposta sem velas")

    // A Twelve Data devolve do mais recente para o mais antigo; o grafico espera crescente.
    candles.sort((a, b) => a.time - b.time)

    candleCache.set(cacheKey, { candles, at: Date.now() })
    return candles
  } catch (e) {
    console.log("[v0] twelvedata erro:", symbol, spec.interval, (e as Error).message)
    // Serve o cache vencido em vez de deixar o grafico sem dado: uma vela de 15s atras e
    // infinitamente melhor que cair na serie achatada do Yahoo.
    return hit?.candles ?? null
  }
}

/** Cotacao ao vivo direto da fonte de mercado. Lanca se a fonte nao responder. */
export async function fetchTradingViewPrice(info: SymbolInfo): Promise<number> {
  const r = await fetch(`https://scanner.tradingview.com/${info.tvScan}/scan`, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json", "User-Agent": "Mozilla/5.0" },
    body: JSON.stringify({
      symbols: { tickers: [info.tv], query: { types: [] } },
      columns: ["close"],
    }),
  })
  if (!r.ok) throw new Error(`tradingview ${r.status}`)

  const j = await r.json()
  const price = Number(j?.data?.[0]?.d?.[0])
  if (!Number.isFinite(price) || price <= 0) throw new Error("preco invalido no tradingview")
  return price
}

// Cache curto do preco upstream, compartilhado por todos os usuarios.
//
// Sem ele, a carga na fonte cresce com o numero de usuarios: cada cliente que consulta o preco
// dispararia uma chamada propria ao TradingView, o que levaria a bloqueio por excesso de
// requisicoes justamente com a plataforma cheia. Com o cache, a fonte e consultada no maximo
// uma vez por segundo por simbolo, independente de haver 1 ou 10.000 usuarios conectados.
//
// O TTL nao reduz a fidelidade: a cotacao de forex a que temos acesso e renovada a cada ~20s,
// entao 1s de cache esta bem abaixo da resolucao real da fonte.
const PRICE_TTL_MS = 1000
const priceCache = new Map<string, { price: number; at: number }>()

/** Preco ao vivo com cache de 1s. Devolve `null` se a fonte falhar. */
export async function getLivePrice(symbol: string): Promise<number | null> {
  const info = SYMBOLS[symbol]
  if (!info) return null

  const hit = priceCache.get(symbol)
  if (hit && Date.now() - hit.at < PRICE_TTL_MS) return hit.price

  try {
    const price = round(await fetchTradingViewPrice(info), info.decimals)
    priceCache.set(symbol, { price, at: Date.now() })
    return price
  } catch {
    return null
  }
}

/** Ultimo preco real GRAVADO pela plataforma no minuto de `atMs` (ou no minuto anterior mais proximo). */
async function getRecordedPriceAt(symbol: string, atMs: number): Promise<number | null> {
  // createAdminClient lanca quando as credenciais nao estao configuradas.
  try {
    const bucket = Math.floor(atMs / 1000 / 60) * 60
    const { data, error } = await createAdminClient()
      .from("market_candles_1m")
      .select("close")
      .eq("symbol", symbol)
      .lte("bucket_time", bucket)
      .order("bucket_time", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error || !data) return null
    const price = Number(data.close)
    return Number.isFinite(price) && price > 0 ? price : null
  } catch {
    return null
  }
}

/**
 * Preco REAL de mercado do ativo no instante `atMs`, para liquidar uma operacao.
 *
 * Ordem de preferencia:
 *  1. Cotacao ao vivo, quando o instante pedido e recente (a operacao acabou de vencer).
 *  2. Historico de ticks reais gravado pela plataforma — auditavel e igual para todos os
 *     usuarios, o que tambem cobre a liquidacao atrasada (ex.: servidor reiniciou).
 *
 * Devolve `null` quando nao existe preco real. Quem chama NAO deve inventar um valor: sem
 * preco de mercado nao ha como decidir ganho ou perda de forma justa.
 */
export async function getRealPriceAt(symbol: string, atMs: number): Promise<number | null> {
  if (!SYMBOLS[symbol]) return null

  // "Recente" = o vencimento acabou de ocorrer, entao a cotacao atual ainda representa o
  // momento da liquidacao. Passado disso, so o historico gravado responde pelo instante certo.
  if (Date.now() - atMs <= 90_000) {
    const live = await getLivePrice(symbol)
    if (live !== null) return live
  }

  return getRecordedPriceAt(symbol, atMs)
}
