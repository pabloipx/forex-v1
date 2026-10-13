"use client"

/**
 * Feed CLIENT-SIDE de precos reais. Faz polling do proxy /api/market/crypto e escreve os
 * valores no real-price-store, de onde o motor de precos le de forma sincrona. Ref-counted
 * por simbolo para nao duplicar timers.
 *
 * Duas frequencias: o TICK (1s) e a cotacao real e vai formando a vela do periodo corrente
 * (high sobe, low desce, close = ultimo preco), como faz uma corretora; o historico de velas
 * (15s) traz o OHLC consolidado. Cada tick tambem alimenta, no servidor, o historico de 1m
 * compartilhado, para que todos os usuarios vejam exatamente as mesmas velas.
 */

import { REAL_FEED_SYMBOLS, setRealPrice, setRealCandles, pushRealTick } from "./real-price-store"

interface FeedState {
  priceTimer: ReturnType<typeof setInterval> | null
  candleTimer: ReturnType<typeof setInterval> | null
  tf: number
  refs: number
}

const feeds = new Map<string, FeedState>()

async function pollPrice(symbol: string, tf: number) {
  try {
    const r = await fetch(`/api/market/crypto?type=price&symbol=${symbol}`, { cache: "no-store" })
    if (!r.ok) return
    const j = await r.json()
    if (!Number.isFinite(j?.price)) return
    const info = REAL_FEED_SYMBOLS[symbol]
    setRealPrice(symbol, j.price)
    // Mantem a vela em formacao acompanhando o preco real entre duas cargas de historico
    if (info) pushRealTick(symbol, tf, j.price, info.decimals)
  } catch {}
}

async function pollCandles(symbol: string, tf: number) {
  try {
    const r = await fetch(`/api/market/crypto?type=candles&symbol=${symbol}&tf=${tf}`, { cache: "no-store" })
    if (!r.ok) return
    const j = await r.json()
    if (Array.isArray(j?.candles) && j.candles.length > 0) setRealCandles(symbol, tf, j.candles)
  } catch {}
}

/**
 * Garante que o feed do simbolo esteja rodando para o timeframe atual. Retorna uma funcao de
 * cleanup (decrementa o ref-count e para os timers quando ninguem mais usa).
 */
export function ensureRealFeed(symbol: string, tf: number): () => void {
  if (!REAL_FEED_SYMBOLS[symbol]) return () => {}

  let s = feeds.get(symbol)
  if (!s) {
    s = { priceTimer: null, candleTimer: null, tf, refs: 0 }
    feeds.set(symbol, s)

    // Historico real primeiro, para o grafico abrir ja com o desenho correto do mercado
    pollCandles(symbol, tf)
    s.candleTimer = setInterval(() => {
      const st = feeds.get(symbol)
      if (st) pollCandles(symbol, st.tf)
    }, 15000)

    // Cadencia dos ticks: 1s, casada com o cache de 1s da rota. Cada leitura e um preco real
    // que alimenta a vela em formacao, entao a vela reflete o mercado na melhor resolucao que a
    // fonte oferece. Ir mais rapido nao acrescenta informacao — a cotacao de forex a que temos
    // acesso e renovada a cada ~20s — e so geraria requisicoes repetidas.
    pollPrice(symbol, tf)
    s.priceTimer = setInterval(() => {
      const st = feeds.get(symbol)
      if (st) pollPrice(symbol, st.tf)
    }, 1000)
  }

  // Timeframe mudou: recarrega as velas do novo tf imediatamente
  if (s.tf !== tf) {
    s.tf = tf
    pollCandles(symbol, tf)
  }

  s.refs++

  return () => {
    const st = feeds.get(symbol)
    if (!st) return
    st.refs--
    if (st.refs <= 0) {
      if (st.priceTimer) clearInterval(st.priceTimer)
      if (st.candleTimer) clearInterval(st.candleTimer)
      feeds.delete(symbol)
    }
  }
}
