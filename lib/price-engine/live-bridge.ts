/**
 * Ponte de preco AO VIVO: WebSocket da Twelve Data -> ouvintes locais, com reserva por consulta.
 *
 * Por que a ponte fica no SERVIDOR e nao no navegador:
 *  - a chave da API nao pode ir para o cliente (qualquer usuario leria o codigo e a usaria);
 *  - o plano gratuito tem apenas 8 creditos de WebSocket. Se cada aba abrisse a propria conexao,
 *    o limite estouraria no segundo usuario. Aqui existe UMA conexao para toda a plataforma,
 *    entao 1 ou 10.000 usuarios consomem os mesmos creditos.
 *
 * O `/api/market/stream` (SSE) repassa estes ticks para o navegador.
 */

import { SYMBOLS, round, getLivePrice } from "./real-quote"
import { recordTick } from "./tick-recorder"

type Listener = (price: number, atMs: number) => void

/** Teto de simbolos assinados no upstream. O plano gratuito da 8 creditos de WS (1 por simbolo). */
const MAX_WS_SYMBOLS = 8

/** Intervalo da reserva por consulta, usada quando o WebSocket nao esta disponivel. */
const POLL_MS = 1500

/** Tempo sem tick do WS que caracteriza conexao muda (o mercado de forex nunca fica 20s parado). */
const STALE_MS = 20_000

interface SymbolState {
  listeners: Set<Listener>
  lastPrice: number | null
  lastAt: number
  /** Timer da reserva. Existe apenas enquanto o WS nao entrega ticks deste simbolo. */
  pollTimer: ReturnType<typeof setInterval> | null
}

const states = new Map<string, SymbolState>()

let ws: WebSocket | null = null
let wsReady = false
/** Backoff da reconexao, para nao martelar o upstream quando a chave nao tem WS liberado. */
let reconnectDelay = 2000
let reconnectTimer: ReturnType<typeof setTimeout> | null = null

function state(symbol: string): SymbolState {
  let s = states.get(symbol)
  if (!s) {
    s = { listeners: new Set(), lastPrice: null, lastAt: 0, pollTimer: null }
    states.set(symbol, s)
  }
  return s
}

function emit(symbol: string, price: number, atMs: number) {
  const s = states.get(symbol)
  if (!s) return
  // Ignora repeticao exata do mesmo preco no mesmo milissegundo (o WS as vezes duplica).
  if (s.lastPrice === price && atMs - s.lastAt < 50) return
  s.lastPrice = price
  s.lastAt = atMs
  for (const fn of s.listeners) {
    try {
      fn(price, atMs)
    } catch {}
  }
}

// =============================================
// UPSTREAM (WebSocket)
// =============================================

/** Simbolos que devem estar assinados agora: os que tem ouvinte, limitados ao teto de creditos. */
function wanted(): string[] {
  return Array.from(states.entries())
    .filter(([, s]) => s.listeners.size > 0)
    .sort((a, b) => b[1].listeners.size - a[1].listeners.size) // prioriza os mais assistidos
    .slice(0, MAX_WS_SYMBOLS)
    .map(([sym]) => sym)
}

function sendSubscribe() {
  if (!ws || !wsReady) return
  const syms = wanted()
    .map((s) => SYMBOLS[s]?.td)
    .filter(Boolean)
  if (syms.length === 0) return
  try {
    ws.send(JSON.stringify({ action: "subscribe", params: { symbols: syms.join(",") } }))
  } catch {}
}

function connect() {
  const key = process.env.TWELVE_DATA_API_KEY
  // Sem chave nao existe WS: todo mundo fica na reserva por consulta, que ja e o suficiente
  // para o grafico funcionar.
  if (!key || ws) return

  try {
    ws = new WebSocket(`wss://ws.twelvedata.com/v1/quotes/price?apikey=${key}`)
  } catch {
    ws = null
    return
  }

  ws.onopen = () => {
    wsReady = true
    reconnectDelay = 2000
    sendSubscribe()
  }

  ws.onmessage = (ev) => {
    let msg: any
    try {
      msg = JSON.parse(String(ev.data))
    } catch {
      return
    }

    // A API responde no proprio socket quando a assinatura e recusada (creditos/plano).
    if (msg?.event === "subscribe-status" && msg?.status === "error") {
      console.log("[v0] ws assinatura recusada:", JSON.stringify(msg?.fails ?? msg).slice(0, 160))
      return
    }
    if (msg?.event !== "price") return

    // O upstream usa o formato "EUR/USD"; internamente o simbolo e "EURUSD".
    const sym = String(msg.symbol ?? "").replace("/", "")
    const info = SYMBOLS[sym]
    const price = Number(msg.price)
    if (!info || !Number.isFinite(price) || price <= 0) return

    const value = round(price, info.decimals)
    emit(sym, value, Date.now())
    // Alimenta o historico de 1m com o tick real, que e o que a liquidacao consulta depois.
    recordTick(sym, value)
  }

  const drop = () => {
    wsReady = false
    ws = null
    if (reconnectTimer) return
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      // So reconecta se ainda houver alguem assistindo.
      if (wanted().length > 0) connect()
    }, reconnectDelay)
    // Backoff ate 30s: se a chave nao tiver WS liberado, nao insiste em loop apertado.
    reconnectDelay = Math.min(reconnectDelay * 2, 30_000)
  }

  ws.onclose = drop
  ws.onerror = drop
}

// =============================================
// RESERVA (consulta periodica)
// =============================================

/**
 * Mantem a consulta periodica ligada enquanto o WebSocket nao estiver entregando ticks deste
 * simbolo. E isto que garante que o grafico continue vivo se o WS cair, se a chave nao tiver
 * WebSocket liberado, ou se o upstream ficar mudo.
 */
function ensurePoll(symbol: string) {
  const s = state(symbol)
  if (s.pollTimer) return

  s.pollTimer = setInterval(async () => {
    const cur = states.get(symbol)
    if (!cur || cur.listeners.size === 0) return

    // WS ativo e entregando: nao gasta requisicao.
    if (wsReady && Date.now() - cur.lastAt < STALE_MS) return

    const p = await getLivePrice(symbol)
    if (p !== null) emit(symbol, p, Date.now())
  }, POLL_MS)
}

function stopPoll(symbol: string) {
  const s = states.get(symbol)
  if (s?.pollTimer) {
    clearInterval(s.pollTimer)
    s.pollTimer = null
  }
}

// =============================================
// API PUBLICA
// =============================================

/**
 * Registra um ouvinte de preco ao vivo. Devolve a funcao de cancelamento.
 *
 * Entrega o ultimo preco conhecido de imediato (quando houver), para o grafico nao ficar parado
 * esperando o proximo tick.
 */
export function subscribeLive(symbol: string, listener: Listener): () => void {
  if (!SYMBOLS[symbol]) return () => {}

  const s = state(symbol)
  s.listeners.add(listener)

  if (s.lastPrice !== null && Date.now() - s.lastAt < STALE_MS) {
    try {
      listener(s.lastPrice, s.lastAt)
    } catch {}
  }

  connect()
  sendSubscribe()
  ensurePoll(symbol)

  return () => {
    s.listeners.delete(listener)
    if (s.listeners.size === 0) stopPoll(symbol)
  }
}

/** Diagnostico: usado pelo SSE para informar a origem do tick (ws ou consulta). */
export function liveSource(symbol: string): "ws" | "poll" {
  const s = states.get(symbol)
  return wsReady && s && Date.now() - s.lastAt < STALE_MS ? "ws" : "poll"
}
