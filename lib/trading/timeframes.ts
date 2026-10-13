import { isRealSymbol } from "@/lib/price-engine/real-price-store"

/**
 * Duracoes de operacao permitidas, por tipo de ativo.
 *
 * MERCADO ABERTO (ativos reais): 5m, 10m e 15m.
 *
 * A restricao existe porque a duracao da operacao nao pode ser menor que a resolucao da fonte
 * de precos. A cotacao de forex a que temos acesso e renovada a cada ~20s: numa operacao de 30s
 * o resultado sairia de 1 ou 2 leituras, e em boa parte das entradas o preco de saida seria
 * identico ao de entrada — o cliente veria empate ou perda por arredondamento, sem relacao com
 * ter acertado a direcao do mercado. A 5m a operacao atravessa ~15 leituras reais, o que da
 * movimento suficiente para o resultado refletir o mercado de verdade.
 *
 * OTC: 1m, 5m e 10m. Sao ativos sinteticos, com preco continuo gerado pela propria plataforma,
 * portanto nao tem limite de resolucao de fonte e mantem a duracao curta.
 */
export type Timeframe = 60 | 300 | 600 | 900

export const TIMEFRAMES_REAL: Timeframe[] = [300, 600, 900]
export const TIMEFRAMES_OTC: Timeframe[] = [60, 300, 600]

export const TIMEFRAME_LABELS: Record<number, string> = {
  60: "1m",
  300: "5m",
  600: "10m",
  900: "15m",
}

/** Duracoes disponiveis para um simbolo. */
export function timeframesFor(symbol: string | undefined | null): Timeframe[] {
  return symbol && isRealSymbol(symbol) ? TIMEFRAMES_REAL : TIMEFRAMES_OTC
}

/**
 * Valida a duracao pedida para o simbolo. Usada tambem no servidor: a lista da interface pode
 * ser burlada por uma chamada direta a API, entao a regra precisa valer na abertura da operacao.
 */
export function isTimeframeAllowed(symbol: string, timeframe: number): boolean {
  return (timeframesFor(symbol) as number[]).includes(timeframe)
}

/**
 * Ajusta a duracao atual para uma valida no simbolo, preservando a intencao do usuario: mantem
 * a escolha quando ela existe nos dois tipos (5m e 10m) e, quando nao existe, vai para a mais
 * proxima. Sem isso, trocar de um OTC em 1m para um ativo real deixaria a tela num tempo
 * inexistente na lista e o botao de operar travado.
 */
export function normalizeTimeframe(symbol: string | undefined | null, timeframe: number): Timeframe {
  const allowed = timeframesFor(symbol)
  if ((allowed as number[]).includes(timeframe)) return timeframe as Timeframe
  return allowed.reduce((best, tf) =>
    Math.abs(tf - timeframe) < Math.abs(best - timeframe) ? tf : best,
  )
}
