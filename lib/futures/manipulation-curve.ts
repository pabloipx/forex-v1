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

/** Deslocamento relativo assinado (ex.: 0.004 = +0,4%) no instante `t`. */
export function offsetAt(m: FuturesManipulation, t: number) {
  const sign = m.direction === "up" ? 1 : -1
  return sign * (m.move_pct / 100) * intensityAt(m, t)
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
