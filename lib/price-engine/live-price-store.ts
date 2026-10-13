"use client"

/**
 * LIVE PRICE STORE — desacopla o tick de preço (~5x/s) do componente gigante da tela de trade.
 *
 * PROBLEMA que isto resolve: antes, o useGlobalOTC chamava setState ~5x/s DENTRO da página de
 * trade (um componente de ~1840 linhas). Cada tick reconciliava a árvore inteira, mesmo com os
 * filhos memoizados bailando — e, como o processamento de toques/cliques divide a mesma thread,
 * os cliques ficavam na fila atrás desse trabalho (o "demora pra entrar onde cliquei" e a demora
 * para trocar o tempo).
 *
 * SOLUÇÃO: o preço vivo passa por este store minúsculo (padrão pub/sub). Só os componentes-folha
 * que realmente EXIBEM o preço (o texto do header) assinam via useSyncExternalStore e re-renderizam
 * — cada um custa praticamente nada. A página em si deixa de re-renderizar no tick, então os
 * cliques respondem de imediato.
 *
 * O robô KAYKO também consome daqui, mas só empurra o valor para um ref (sem re-render), então
 * assinar o store não o faz reconciliar.
 */

type Listener = () => void

let livePrice = 0
const listeners = new Set<Listener>()

/** Chamado pelo loop do useGlobalOTC. Notifica os assinantes apenas quando o preço muda. */
export function publishLivePrice(price: number) {
  if (price === livePrice) return
  livePrice = price
  for (const listener of listeners) listener()
}

/** Snapshot estável para useSyncExternalStore (número → comparado por Object.is). */
export function getLivePrice(): number {
  return livePrice
}

export function subscribeLivePrice(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
