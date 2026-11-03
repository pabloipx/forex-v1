import { getInvestAsset, type InvestAsset } from "@/lib/invest-assets"
import { INVEST_MONTHLY_RATE, INVEST_MONTHS, payoutAt, type InvestmentView } from "@/lib/invest-schedule"

export const SLICE_COLORS = ["#1e8bff", "#16d98a", "#f5b51b", "#8b5cf6", "#22d3ee", "#fb7a3c", "#f472b6", "#2dd4bf", "#f87171", "#a3e635"]

export interface AllocationSlice {
  asset: InvestAsset
  value: number
  share: number
  rate: number
  color: string
}

export interface EvolutionPoint {
  time: number
  value: number
  projected: boolean
}

export interface Portfolio {
  sample: boolean
  total: number
  invested: number
  available: number
  monthlyYield: number
  monthlyRate: number
  annualPct: number
  slices: AllocationSlice[]
  evolution: EvolutionPoint[]
  nextPayoutAt: string | null
  cycleProgress: number
  active: InvestmentView[]
}

const DAY = 86_400_000

function earnedAt(inv: InvestmentView, t: number) {
  const start = new Date(inv.startedAt)
  if (t <= start.getTime()) return 0
  let earned = 0
  let prev = start.getTime()
  for (let k = 1; k <= inv.months; k++) {
    const due = payoutAt(start, k).getTime()
    if (t >= due) {
      earned += inv.monthlyYield
      prev = due
      continue
    }
    earned += inv.monthlyYield * Math.max(0, (t - prev) / (due - prev))
    break
  }
  return earned
}

function buildEvolution(list: InvestmentView[], now: number): EvolutionPoint[] {
  if (list.length === 0) return []
  const first = Math.min(...list.map((i) => new Date(i.startedAt).getTime()))
  const last = Math.max(...list.map((i) => new Date(i.unlockAt).getTime()), now)
  const start = first
  const steps = 60
  const step = Math.max(DAY / 4, (last - start) / steps)
  const points: EvolutionPoint[] = []
  for (let t = start; t <= last + 1; t += step) {
    points.push({ time: t, value: valueAt(list, t), projected: t > now })
  }
  if (now > start && now < last) points.push({ time: now, value: valueAt(list, now), projected: false })
  return points.sort((a, b) => a.time - b.time)
}

const valueAt = (list: InvestmentView[], t: number) =>
  list.reduce((sum, inv) => (new Date(inv.startedAt).getTime() <= t ? sum + inv.amount + earnedAt(inv, t) : sum), 0)

function cycle(active: InvestmentView[], now: number) {
  const next = active
    .map((i) => i.nextPayoutAt)
    .filter((d): d is string => Boolean(d))
    .sort()[0]
  if (!next) return { nextPayoutAt: null, cycleProgress: active.length ? 1 : 0 }
  const end = new Date(next).getTime()
  const owner = active.find((i) => i.nextPayoutAt === next)!
  const prevDue = owner.payoutsDone > 0 ? payoutAt(new Date(owner.startedAt), owner.payoutsDone).getTime() : new Date(owner.startedAt).getTime()
  return { nextPayoutAt: next, cycleProgress: Math.min(1, Math.max(0, (now - prevDue) / (end - prevDue))) }
}

export function buildPortfolio(investments: InvestmentView[], now = Date.now()): Portfolio {
  const sample = investments.length === 0
  const list = sample ? sampleInvestments(now) : investments
  const active = list.filter((i) => i.status === "active")
  const invested = active.reduce((s, i) => s + i.amount, 0)
  const available = list.reduce((s, i) => s + i.available, 0)
  const monthlyYield = active.reduce((s, i) => s + i.monthlyYield, 0)
  const monthlyRate = invested > 0 ? monthlyYield / invested : INVEST_MONTHLY_RATE

  const byAsset = new Map<string, { value: number; yield: number }>()
  for (const inv of active) {
    const cur = byAsset.get(inv.asset) ?? { value: 0, yield: 0 }
    byAsset.set(inv.asset, { value: cur.value + inv.amount, yield: cur.yield + inv.monthlyYield })
  }
  const slices = [...byAsset.entries()]
    .sort((a, b) => b[1].value - a[1].value)
    .map(([id, v], i) => ({
      asset: getInvestAsset(id),
      value: v.value,
      share: invested > 0 ? v.value / invested : 0,
      rate: v.value > 0 ? v.yield / v.value : 0,
      color: SLICE_COLORS[i % SLICE_COLORS.length],
    }))

  return {
    sample,
    total: invested + available,
    invested,
    available,
    monthlyYield,
    monthlyRate,
    annualPct: (Math.pow(1 + monthlyRate, 12) - 1) * 100,
    slices,
    evolution: buildEvolution(list, now),
    ...cycle(active, now),
    active,
  }
}

const SAMPLE = [
  { asset: "XAU", amount: 4000 },
  { asset: "USD", amount: 2500 },
  { asset: "EUR", amount: 2000 },
  { asset: "SGOV", amount: 1500 },
]

function sampleInvestments(now: number): InvestmentView[] {
  const start = new Date(now - 40 * DAY)
  return SAMPLE.map((s, i) => {
    const payoutsDone = [1, 2, 3].filter((k) => payoutAt(start, k).getTime() <= now).length
    return {
      id: `sample-${i}`,
      asset: s.asset,
      amount: s.amount,
      monthlyRate: INVEST_MONTHLY_RATE,
      monthlyYield: s.amount * INVEST_MONTHLY_RATE,
      months: INVEST_MONTHS,
      startedAt: start.toISOString(),
      payoutsDone,
      nextPayoutAt: payoutsDone < INVEST_MONTHS ? payoutAt(start, payoutsDone + 1).toISOString() : null,
      unlockAt: payoutAt(start, INVEST_MONTHS).toISOString(),
      yieldPaid: 0,
      available: 0,
      status: "active" as const,
    }
  })
}

export const fmtPct = (v: number, digits = 2) =>
  `${v.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`
