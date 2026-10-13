// Sistema de ranking com 5 niveis.
// Cada rank exige DUAS metas simultaneas: total depositado (acumulado, depositos aprovados/concluidos)
// E numero de entradas reais realizadas. O usuario so sobe de rank quando bate as duas.

export interface Rank {
  id: number
  name: string
  /** Meta minima de total depositado (BRL, acumulado) para atingir este rank */
  minDeposit: number
  /** Meta minima de entradas reais realizadas para atingir este rank */
  minEntries: number
  /** Cor de destaque do rank (usada em badges/barras) */
  color: string
}

export const RANKS: Rank[] = [
  { id: 0, name: "Bronze", minDeposit: 0, minEntries: 0, color: "#cd7f32" },
  { id: 1, name: "Prata", minDeposit: 100, minEntries: 20, color: "#9ca3af" },
  { id: 2, name: "Ouro", minDeposit: 500, minEntries: 100, color: "#eab308" },
  { id: 3, name: "Platina", minDeposit: 2000, minEntries: 500, color: "#22d3ee" },
  { id: 4, name: "Diamante", minDeposit: 10000, minEntries: 2000, color: "#fb923c" },
]

export interface RankProgress {
  current: Rank
  next: Rank | null
  /** Progresso (0-100) do deposito rumo ao proximo rank */
  depositPct: number
  /** Progresso (0-100) das entradas rumo ao proximo rank */
  entriesPct: number
  /** Progresso geral (0-100) rumo ao proximo rank (menor das duas metas) */
  overallPct: number
  /** Quanto falta de deposito para o proximo rank (0 se ja atingiu) */
  depositRemaining: number
  /** Quantas entradas faltam para o proximo rank (0 se ja atingiu) */
  entriesRemaining: number
  totalDeposited: number
  totalEntries: number
}

/**
 * Calcula o rank atual do usuario e o progresso rumo ao proximo nivel.
 * O rank atual e o MAIOR rank cujas duas metas (deposito E entradas) foram atingidas.
 */
export function computeRank(totalDeposited: number, totalEntries: number): RankProgress {
  let current = RANKS[0]
  for (const rank of RANKS) {
    if (totalDeposited >= rank.minDeposit && totalEntries >= rank.minEntries) {
      current = rank
    }
  }

  const next = current.id < RANKS.length - 1 ? RANKS[current.id + 1] : null

  if (!next) {
    return {
      current,
      next: null,
      depositPct: 100,
      entriesPct: 100,
      overallPct: 100,
      depositRemaining: 0,
      entriesRemaining: 0,
      totalDeposited,
      totalEntries,
    }
  }

  const depositSpan = next.minDeposit - current.minDeposit
  const entriesSpan = next.minEntries - current.minEntries

  const depositPct =
    depositSpan <= 0 ? 100 : clampPct(((totalDeposited - current.minDeposit) / depositSpan) * 100)
  const entriesPct =
    entriesSpan <= 0 ? 100 : clampPct(((totalEntries - current.minEntries) / entriesSpan) * 100)

  return {
    current,
    next,
    depositPct,
    entriesPct,
    // O progresso geral e limitado pela meta mais atrasada (as duas precisam ser batidas).
    overallPct: Math.min(depositPct, entriesPct),
    depositRemaining: Math.max(0, next.minDeposit - totalDeposited),
    entriesRemaining: Math.max(0, next.minEntries - totalEntries),
    totalDeposited,
    totalEntries,
  }
}

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, n))
}
