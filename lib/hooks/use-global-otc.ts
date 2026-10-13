"use client"

import { useEffect, useState, useRef } from "react"
import { multiAssetEngine, OTC_ASSETS, type OTCCandle } from "@/lib/price-engine/multi-asset-engine"
import { ensureRealFeed } from "@/lib/price-engine/real-price-feed"
import { hasRealPrice, getRealRevision, isRealSymbol, getRealCandles } from "@/lib/price-engine/real-price-store"
import { ensureManipulationSync } from "@/lib/price-engine/manipulation-sync"
import { publishLivePrice } from "@/lib/price-engine/live-price-store"

/**
 * useGlobalOTC — feed de preco 100% CLIENT-SIDE.
 *
 * O motor de precos (multiAssetEngine) e puro e deterministico: para um dado (ativo, tempo)
 * ele sempre produz o mesmo preco/velas, no cliente ou no servidor. Por isso calculamos tudo
 * localmente no navegador via requestAnimationFrame — SEM chamadas de rede.
 *
 * Isso elimina a causa raiz do "grafico travado / preco em ...": antes o app dependia dos
 * endpoints serverless (/api/global/state), que sofrem cold start e latencia em producao,
 * segurando o preco em 0 ("...") por varios segundos. Agora o grafico aparece carregado
 * instantaneamente na entrada e a troca de ativo e imediata, sem delay e sem congelamento.
 *
 * A liquidacao de operacoes continua no servidor (usando o mesmo motor deterministico),
 * entao os precos exibidos e os de liquidacao permanecem consistentes.
 */
export function useGlobalOTC(symbol: string, timeframe: 60 | 300 | 600 | 900) {
  const validSymbol = OTC_ASSETS.find((a) => a.symbol === symbol)?.symbol || "EURUSD_OTC"
  const asset = OTC_ASSETS.find((a) => a.symbol === validSymbol) || OTC_ASSETS[0]

  // Re-render RARO: dispara apenas quando os flags de "dados reais prontos" mudam (2x no ciclo
  // de vida), para o gráfico recarregar com o histórico real via reloadKey. O tick de PREÇO
  // (~5x/s) NÃO re-renderiza mais esta página — ele vai para o live-price-store, e só os
  // componentes-folha que exibem o preço reagem. Era o setState de 5x/s aqui que reconciliava a
  // árvore inteira da tela de trade e deixava os cliques lentos.
  const [, setReadyFlags] = useState(0)
  const readyFlagsRef = useRef(-1)

  const smoothRef = useRef(0)
  const candlesRef = useRef<OTCCandle[]>([])
  const liveCandleRef = useRef<OTCCandle | null>(null)
  const candleStartRef = useRef(0)
  const lastUiRef = useRef(0)
  const mountedRef = useRef(true)
  const keyRef = useRef("")
  const realRevRef = useRef(-1)

  // Inicializacao SINCRONA durante o render sempre que o ativo/timeframe muda. Como as funcoes
  // do motor sao puras e deterministicas, calcular aqui e seguro e garante que os dados
  // retornados ja estao corretos NO MESMO render — troca instantanea, sem flash nem delay.
  const key = `${validSymbol}_${timeframe}`
  if (keyRef.current !== key) {
    keyRef.current = key
    candlesRef.current = multiAssetEngine.getCandles(validSymbol, timeframe)
    smoothRef.current = multiAssetEngine.getCurrentPrice(validSymbol)
    liveCandleRef.current = multiAssetEngine.getCurrentCandle(validSymbol, timeframe)
    candleStartRef.current = Math.floor(Date.now() / 1000 / timeframe) * timeframe
  }

  // Inicia (e mantem) o feed de preco REAL para simbolos de mercado aberto (ex.: BTC/USD).
  // Para os demais ativos e um no-op. O feed escreve no store, que o motor le sincronamente.
  useEffect(() => {
    if (!isRealSymbol(validSymbol)) return
    const stop = ensureRealFeed(validSymbol, timeframe)
    return stop
  }, [validSymbol, timeframe])

  // Sincroniza as manipulacoes do admin (singleton, roda uma unica vez por aba).
  useEffect(() => {
    ensureManipulationSync()
  }, [])

  // Loop de animacao: recalcula o preco vivo deterministicamente a cada frame.
  //
  // IMPORTANTE — este efeito usa um flag `alive` LOCAL (nao o mountedRef compartilhado) e mantem
  // no maximo UM requestAnimationFrame pendente por vez. Isso corrige dois bugs que travavam a
  // corretora ao minimizar/voltar a aba ou ao trocar de par rapidamente:
  //   1) MULTIPLICACAO DE LOOPS: antes o watchdog chamava step(), e step() reagendava um rAF. Em
  //      segundo plano o rAF congela mas o watchdog continua enfileirando rAFs; ao voltar, TODOS
  //      disparavam de uma vez, cada um iniciando seu proprio loop -> dezenas de loops paralelos.
  //      Agora o watchdog chama apenas compute() (que NAO agenda rAF), entao nada se multiplica.
  //   2) RESSURREICAO DE LOOPS ANTIGOS: o mountedRef compartilhado volta a true no efeito seguinte,
  //      entao um rAF antigo enfileirado podia disparar depois da troca de par e rodar com o
  //      simbolo antigo. O flag `alive` e capturado por-efeito e fica false para sempre no cleanup,
  //      entao callbacks obsoletos abortam de vez.
  useEffect(() => {
    mountedRef.current = true
    let alive = true
    let raf = 0
    let lastFrame = 0
    realRevRef.current = -1

    // Faz o trabalho de UM frame. NAO agenda o proximo rAF — quem agenda e o loop/onVisible.
    // Assim o watchdog pode chama-lo para avancar a interpolacao sem criar novos loops.
    const compute = () => {
      const nowMs = Date.now()
      const now = nowMs / 1000
      const cs = Math.floor(now / timeframe) * timeframe

      // Cruzou o limite de uma nova vela: reconstroi o historico recente (barato, ~30 velas).
      if (cs !== candleStartRef.current) {
        candleStartRef.current = cs
        candlesRef.current = multiAssetEngine.getCandles(validSymbol, timeframe)
      }

      // Dados reais chegaram/atualizaram: reconstroi o historico com as velas reais.
      const rev = getRealRevision(validSymbol)
      if (rev !== realRevRef.current) {
        realRevRef.current = rev
        candlesRef.current = multiAssetEngine.getCandles(validSymbol, timeframe)
      }

      const target = multiAssetEngine.getCurrentPrice(validSymbol)
      const real = isRealSymbol(validSymbol)

      if (real) {
        // Mercado aberto: o preco e o ultimo tick real, usado como veio. Suavizar aqui criava
        // um valor intermediario que nunca foi negociado e que era empurrado para dentro da
        // vela, inflando maxima/minima a cada frame.
        if (target > 0) smoothRef.current = target
      } else {
        // OTC: suavizacao leve entre frames (motor sintetico continuo). Inalterado.
        if (smoothRef.current <= 0) smoothRef.current = target
        else smoothRef.current += (target - smoothRef.current) * 0.25
      }

      const price = Number(smoothRef.current.toFixed(asset.decimals))
      const cc = multiAssetEngine.getCurrentCandle(validSymbol, timeframe)
      if (cc) {
        // Mercado aberto: o OHLC do motor JA e o acumulado dos ticks reais do periodo — usado
        // exatamente como veio. Nos OTC a vela segue fechando no preco suavizado.
        liveCandleRef.current = real
          ? cc
          : {
              time: cc.time,
              open: cc.open,
              close: price,
              high: Math.max(cc.high, price),
              low: Math.min(cc.low, price),
            }
      }

      // Tick de PREÇO a ~5x/s (200ms) — vai para o live-price-store, NÃO re-renderiza esta página.
      // O gráfico anima-se sozinho num rAF lendo o preço direto do motor; o texto de preço do
      // header e o robô consomem do store. Assim a árvore gigante da tela de trade não reconcilia
      // no tick e os cliques ficam responsivos.
      const p = performance.now()
      if (p - lastUiRef.current > 200) {
        lastUiRef.current = p
        publishLivePrice(price)
      }

      // Re-render RARO da página: só quando o estado de "dados reais prontos" muda (preço real
      // chegou / histórico real chegou), para o gráfico recarregar via reloadKey. Isso acontece
      // ~2x no ciclo de vida — nada a ver com o tick de preço.
      const readyNow =
        (isRealSymbol(validSymbol) && hasRealPrice(validSymbol) ? 1 : 0) +
        (isRealSymbol(validSymbol) && (getRealCandles(validSymbol, timeframe)?.length ?? 0) >= 2 ? 2 : 0)
      if (readyNow !== readyFlagsRef.current) {
        readyFlagsRef.current = readyNow
        setReadyFlags(readyNow)
      }
      lastFrame = nowMs
    }

    // Loop rAF: no maximo UM agendado por vez. Ao entrar, zera `raf` (ja disparou); so reagenda
    // se ainda estiver vivo. Um callback obsoleto de um efeito anterior aborta aqui via `alive`.
    const loop = () => {
      raf = 0
      if (!alive) return
      compute()
      raf = requestAnimationFrame(loop)
    }

    raf = requestAnimationFrame(loop)

    // Watchdog: garante que a interpolacao SEMPRE avance mesmo se o rAF for estrangulado
    // (preview em iframe, aba em segundo plano, alguns navegadores mobile). Chama apenas
    // compute() — nunca agenda rAF — para nao multiplicar loops em segundo plano.
    const watchdog = setInterval(() => {
      if (alive && Date.now() - lastFrame > 250) compute()
    }, 250)

    const onVisible = () => {
      if (typeof document !== "undefined" && !document.hidden && alive) {
        // Cancela o rAF pendente (se houver) e reinicia UM unico loop — nunca acumula.
        if (raf) cancelAnimationFrame(raf)
        raf = requestAnimationFrame(loop)
      }
    }
    document.addEventListener("visibilitychange", onVisible)
    window.addEventListener("focus", onVisible)
    // pageshow: retomada pelo cache de historico (bfcache) do iOS Safari, onde os outros
    // eventos nao disparam de forma confiavel ao voltar para a aba.
    window.addEventListener("pageshow", onVisible)

    return () => {
      alive = false
      mountedRef.current = false
      if (raf) cancelAnimationFrame(raf)
      clearInterval(watchdog)
      document.removeEventListener("visibilitychange", onVisible)
      window.removeEventListener("focus", onVisible)
      window.removeEventListener("pageshow", onVisible)
    }
  }, [validSymbol, timeframe, asset.decimals])

  // Monta o array de velas com a vela viva no final.
  const allCandles = [...candlesRef.current]
  const live = liveCandleRef.current
  if (live && live.time > 0) {
    const idx = allCandles.findIndex((c) => c.time === live.time)
    if (idx >= 0) allCandles[idx] = live
    else allCandles.push(live)
  }

  return {
    symbol: validSymbol,
    name: asset.name,
    // Nunca 0: se a suavizacao ainda nao rodou, usa o preco deterministico direto.
    price: smoothRef.current || multiAssetEngine.getCurrentPrice(validSymbol),
    candles: allCandles,
    currentCandle: live,
    timestamp: Math.floor(Date.now() / 1000),
    isConnected: true,
    // true quando o simbolo usa feed real E o preco real ja chegou (usado para recarregar o
    // grafico com o historico real assim que ele fica disponivel).
    realReady: isRealSymbol(validSymbol) && hasRealPrice(validSymbol),
    // true quando o HISTORICO real ja chegou. Sinal separado do preco de proposito: o preco
    // chega em ~80ms e o historico em ~300ms, entao recarregar o grafico apenas com realReady
    // o redesenhava antes de existir historico, deixando-o praticamente vazio.
    realHistoryReady:
      isRealSymbol(validSymbol) && (getRealCandles(validSymbol, timeframe)?.length ?? 0) >= 2,
    error: null as string | null,
  }
}
