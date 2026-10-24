export type ManipulationDirection = "up" | "down"

export interface FuturesManipulation {
  id: string
  symbol: string
  direction: ManipulationDirection
  /** Deslocamento máximo sobre o preço real, em % */
  move_pct: number
  ramp_seconds: number
  hold_seconds: number
  release_seconds: number
  start_time: string
  end_time: string
  stopped_at: string | null
  /** Preço no instante em que a manipulação começou; é dele que o movimento parte. */
  anchor_price?: number | null
  note: string | null
  created_at: string
}

export type ManipulationPhase = "scheduled" | "ramp" | "hold" | "release" | "done"

export const PHASE_LABELS: Record<ManipulationPhase, string> = {
  scheduled: "Agendada",
  ramp: "Empurrando",
  hold: "Segurando",
  release: "Devolvendo",
  done: "Encerrada",
}

// Curva monotônica com início e fim suaves (velocidade zero nas pontas): o deslocamento nunca
// recua sozinho, então o único "ruído" visível é o do próprio mercado real por baixo.
const smooth = (u: number) => {
  const x = Math.min(1, Math.max(0, u))
  return x * x * x * (x * (6 * x - 15) + 10)
}

/** Intensidade (0..1) sem o sinal da direção, no instante `t` (ms). */
function intensityPlanned(m: FuturesManipulation, t: number) {
  const start = new Date(m.start_time).getTime()
  const rampEnd = start + m.ramp_seconds * 1000
  const holdEnd = rampEnd + m.hold_seconds * 1000
  const end = holdEnd + m.release_seconds * 1000
  if (t <= start || t >= end) return 0
  if (t < rampEnd) return smooth((t - start) / (rampEnd - start))
  if (t < holdEnd) return 1
  return 1 - smooth((t - holdEnd) / (end - holdEnd))
}

/** Intensidade considerando uma parada manual: devolve a partir do nível em que estava. */
export function intensityAt(m: FuturesManipulation, t: number) {
  if (!m.stopped_at) return intensityPlanned(m, t)
  const stop = new Date(m.stopped_at).getTime()
  if (t <= stop) return intensityPlanned(m, t)
  const level = intensityPlanned(m, stop)
  return level * (1 - smooth((t - stop) / (m.release_seconds * 1000)))
}

/** Deslocamento relativo planejado (ex.: 0.004 = +0,4%) sobre o preço âncora. */
export function offsetAt(m: FuturesManipulation, t: number) {
  const sign = m.direction === "up" ? 1 : -1
  return sign * (m.move_pct / 100) * intensityAt(m, t)
}

// Quanto do movimento real continua visível durante o controle. Só o "balanço" do mercado
// passa, nunca a tendência: o limite garante que a direção escolhida sempre vença.
const NOISE_SHARE = 0.35
const NOISE_CAP = 0.25

/** Instante em que o preço deixa de ser conduzido e começa a voltar para o real. */
function releaseStart(m: FuturesManipulation) {
  const planned = new Date(m.start_time).getTime() + (m.ramp_seconds + m.hold_seconds) * 1000
  return m.stopped_at ? Math.min(planned, new Date(m.stopped_at).getTime()) : planned
}

/** Âncora implícita quando ela é capturada depois do início: evita salto no preço. */
export function inferAnchor(m: FuturesManipulation, t: number, price: number) {
  return price / (1 + offsetAt(m, t))
}

/**
 * Preço exibido no instante `t`, dado o preço que chegaria sem esta manipulação.
 * O alvo parte do preço no início (âncora), então "subir" sobe mesmo com o mercado caindo
 * e "cair" aprofunda a queda de forma contínua. Na devolução, desliza suave até o real.
 */
export function priceAt(m: FuturesManipulation, t: number, price: number, anchor: number | null) {
  const start = new Date(m.start_time).getTime()
  if (t <= start || t >= effectiveEnd(m) || !(price > 0)) return price
  if (!anchor || !(anchor > 0)) return price * (1 + offsetAt(m, t))

  const relStart = releaseStart(m)
  const conducted = t < relStart
  const offset = offsetAt(m, conducted ? t : relStart)

  const limit = (m.move_pct / 100) * NOISE_CAP
  const drift = Math.log(price / anchor) * NOISE_SHARE
  const noise = Math.exp(Math.max(-limit, Math.min(limit, drift)))
  const anchored = anchor * (1 + offset) * noise
  // Mercado já indo a favor: soma o movimento por cima dele em vez de segurá-lo no alvo.
  const riding = price * (1 + offset)
  const target = m.direction === "up" ? Math.max(anchored, riding) : Math.min(anchored, riding)
  if (conducted) return target

  const level = intensityAt(m, relStart)
  const weight = level > 0 ? intensityAt(m, t) / level : 0
  return Math.exp(Math.log(target) * weight + Math.log(price) * (1 - weight))
}

export function effectiveEnd(m: FuturesManipulation) {
  if (m.stopped_at) {
    const stopEnd = new Date(m.stopped_at).getTime() + m.release_seconds * 1000
    return Math.min(stopEnd, new Date(m.end_time).getTime())
  }
  return new Date(m.end_time).getTime()
}

export function phaseAt(m: FuturesManipulation, t: number): ManipulationPhase {
  const start = new Date(m.start_time).getTime()
  if (t < start) return "scheduled"
  if (t >= effectiveEnd(m)) return "done"
  if (m.stopped_at && t >= new Date(m.stopped_at).getTime()) return "release"
  const rampEnd = start + m.ramp_seconds * 1000
  const holdEnd = rampEnd + m.hold_seconds * 1000
  if (t < rampEnd) return "ramp"
  if (t < holdEnd) return "hold"
  return "release"
}

export function totalSeconds(ramp: number, hold: number, release: number) {
  return ramp + hold + release
}
