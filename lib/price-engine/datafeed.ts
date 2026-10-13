/**
 * Datafeed: camada unica de acesso a dados do grafico.
 *
 * Reune num so lugar as cinco operacoes que o grafico precisa — onReady, resolveSymbol, getBars,
 * subscribeBars, unsubscribeBars — no lugar de espalhar `fetch`, timers e leitura de store pelo
 * componente. A biblioteca de grafico (lightweight-charts), a interface, os indicadores e as
 * ferramentas continuam exatamente como estao: isto troca apenas de onde vem o dado.
 *
 * Diferenca central em relacao ao acesso anterior:
 *  - o historico de mercado aberto vem do OHLC real agregado (com maxima e minima de verdade);
 *  - o preco ao vivo chega por WebSocket via SSE, com reserva automatica por consulta.
 *
 * OTC segue no motor deterministico, intocado.
 */

import { multiAssetEngine } from "./multi-asset-engine"
import { isRealSymbol, setRealCandles, setRealPrice } from "./real-price-store"

export type Resolution = 60 | 300 | 600 | 900

export interface Bar {
  time: number
  open: number
  high: number
  low: number
  close: number
}

export interface DatafeedConfig {
  supported_resolutions: Resolution[]
  supports_time: boolean
}

export interface ResolvedSymbol {
  symbol: string
  /** Casas decimais para formatar o preco. */
  decimals: number
  /** `true` = mercado aberto (dado real); `false` = OTC (motor sintetico). */
  real: boolean
  /** Se o ativo aceita fluxo ao vivo por WebSocket. */
  hasRealtime: boolean
}

export type BarListener = (bar: Bar, isNew: boolean) => void

const RESOLUTIONS: Resolution[] = [60, 300, 600, 900]

// =============================================
// onReady
// =============================================

/** Informa ao grafico o que este datafeed suporta. Assincrono por contrato, resolvido na hora. */
export function onReady(callback: (config: DatafeedConfig) => void): void {
  // setTimeout(0) mantem o contrato assincrono: o chamador nunca recebe o callback antes de
  // terminar de montar, o que evitaria estado incompleto no primeiro desenho.
  setTimeout(() => callback({ supported_resolutions: RESOLUTIONS, supports_time: true }), 0)
}

// =============================================
// resolveSymbol
// =============================================

/** Casas decimais por ativo, usadas na formatacao do eixo e do preco. */
function decimalsFor(symbol: string): number {
  const s = symbol.replace("_OTC", "")
  if (s.includes("BTC") || s.includes("ETH")) return 2
  return s.endsWith("JPY") ? 3 : 5
}

export function resolveSymbol(symbol: string): Promise<ResolvedSymbol> {
  const real = isRealSymbol(symbol)
  return Promise.resolve({
    symbol,
    decimals: decimalsFor(symbol),
    real,
    hasRealtime: real,
  })
}

// =============================================
// getBars
// =============================================

/**
 * Historico de velas do ativo no periodo pedido.
 *
 * Mercado aberto: busca o OHLC real na API. O resultado tambem e gravado no store, porque e dele
 * que a LIQUIDACAO das operacoes le o preco — grafico e resultado precisam ler a mesma serie.
 * OTC: le o motor deterministico.
 */
export async function getBars(symbol: string, resolution: Resolution): Promise<Bar[]> {
  if (!isRealSymbol(symbol)) {
    return multiAssetEngine.getHistory(symbol, resolution) as Bar[]
  }

  try {
    const r = await fetch(`/api/market/crypto?type=candles&symbol=${symbol}&tf=${resolution}`, {
      cache: "no-store",
    })
    if (!r.ok) throw new Error(`candles ${r.status}`)

    const j = await r.json()
    const bars: Bar[] = Array.isArray(j?.candles) ? j.candles : []
    if (bars.length === 0) return []

    setRealCandles(symbol, resolution, bars)
    const last = bars[bars.length - 1]
    if (last) setRealPrice(symbol, last.close)

    // Passa pelo motor para manter a ancoragem e qualquer ajuste ja existente no fluxo atual.
    return multiAssetEngine.getHistory(symbol, resolution) as Bar[]
  } catch (e) {
    console.log("[v0] datafeed getBars erro:", symbol, resolution, (e as Error).message)
    // Devolve o que o motor tiver em cache em vez de zerar o grafico.
    return multiAssetEngine.getHistory(symbol, resolution) as Bar[]
  }
}

// =============================================
// subscribeBars / unsubscribeBars
// =============================================

interface Subscription {
  symbol: string
  resolution: Resolution
  listener: BarListener
  /** Vela em formacao, atualizada tick a tick. */
  current: Bar | null
  es: EventSource | null
  pollTimer: ReturnType<typeof setInterval> | null
  otcTimer: ReturnType<typeof setInterval> | null
}

const subscriptions = new Map<string, Subscription>()

/** Aplica um tick na vela em formacao, abrindo uma nova quando o periodo virou. */
function applyTick(sub: Subscription, price: number, atMs: number) {
  const bucket = Math.floor(atMs / 1000 / sub.resolution) * sub.resolution

  if (!sub.current || bucket > sub.current.time) {
    // Nova vela: abre no preco do tick. `open` do periodo seguinte = ultimo close, para a serie
    // nao apresentar salto artificial entre velas.
    const open = sub.current ? sub.current.close : price
    sub.current = { time: bucket, open, high: Math.max(open, price), low: Math.min(open, price), close: price }
    sub.listener(sub.current, true)
    return
  }

  // Tick atrasado de uma vela ja fechada: ignora, senao reescreveria o passado.
  if (bucket < sub.current.time) return

  sub.current.high = Math.max(sub.current.high, price)
  sub.current.low = Math.min(sub.current.low, price)
  sub.current.close = price
  sub.listener(sub.current, false)
}

/** Reserva por consulta: usada se o SSE falhar ou for cortado no caminho. */
function startPolling(sub: Subscription) {
  if (sub.pollTimer) return
  sub.pollTimer = setInterval(async () => {
    try {
      const r = await fetch(`/api/market/crypto?type=price&symbol=${sub.symbol}`, {
        cache: "no-store",
      })
      if (!r.ok) return
      const j = await r.json()
      const p = Number(j?.price)
      if (Number.isFinite(p) && p > 0) {
        setRealPrice(sub.symbol, p)
        applyTick(sub, p, Date.now())
      }
    } catch {}
  }, 2000)
}

function stopPolling(sub: Subscription) {
  if (sub.pollTimer) {
    clearInterval(sub.pollTimer)
    sub.pollTimer = null
  }
}

/**
 * Assina atualizacoes ao vivo da vela atual.
 *
 * Mercado aberto: WebSocket (via SSE do servidor), com reserva por consulta se a conexao cair —
 * e o modo "WebSocket com reserva". O identificador devolvido serve para o unsubscribeBars.
 */
export function subscribeBars(
  symbol: string,
  resolution: Resolution,
  listener: BarListener,
  lastBar?: Bar | null,
): string {
  const id = `${symbol}:${resolution}:${Math.random().toString(36).slice(2, 8)}`
  const sub: Subscription = {
    symbol,
    resolution,
    listener,
    current: lastBar ?? null,
    es: null,
    pollTimer: null,
    otcTimer: null,
  }
  subscriptions.set(id, sub)

  if (!isRealSymbol(symbol)) {
    // OTC: o motor gera o proprio preco, basta ler em intervalo curto.
    sub.otcTimer = setInterval(() => {
      const p = multiAssetEngine.getCurrentPrice(symbol)
      if (p > 0) applyTick(sub, p, Date.now())
    }, 1000)
    return id
  }

  try {
    const es = new EventSource(`/api/market/stream?symbol=${symbol}`)
    sub.es = es

    es.addEventListener("price", (ev) => {
      try {
        const d = JSON.parse((ev as MessageEvent).data)
        const p = Number(d?.price)
        if (!Number.isFinite(p) || p <= 0) return
        // Chegou tick pelo fluxo: a reserva por consulta nao precisa gastar requisicao.
        stopPolling(sub)
        setRealPrice(symbol, p)
        applyTick(sub, p, Number(d?.at) || Date.now())
      } catch {}
    })

    es.onerror = () => {
      // O EventSource tenta reconectar sozinho; a reserva cobre o intervalo sem ticks.
      startPolling(sub)
    }
  } catch {
    startPolling(sub)
  }

  // Rede de seguranca: se em 6s nenhum tick chegou pelo fluxo, liga a reserva.
  setTimeout(() => {
    if (subscriptions.has(id) && !sub.current) startPolling(sub)
  }, 6000)

  return id
}

/** Encerra a assinatura e libera conexao e timers. Chamar sempre que o ativo ou o tempo mudar. */
export function unsubscribeBars(id: string): void {
  const sub = subscriptions.get(id)
  if (!sub) return
  sub.es?.close()
  stopPolling(sub)
  if (sub.otcTimer) clearInterval(sub.otcTimer)
  subscriptions.delete(id)
}
