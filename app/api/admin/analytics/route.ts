import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isAdminRequest } from "@/lib/admin/session"


async function isAdminAuthenticated(): Promise<boolean> {
  return isAdminRequest()
}

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export async function GET(request: Request) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized", details: "Invalid admin token" }, { status: 401 })
    }

    const adminClient = createAdminClient()

    const DAYS = 14
    const now = new Date()
    const start = new Date(now)
    start.setDate(start.getDate() - (DAYS - 1))
    start.setHours(0, 0, 0, 0)
    const startISO = start.toISOString()

    // Build ordered list of day buckets
    const buckets: string[] = []
    for (let i = 0; i < DAYS; i++) {
      const d = new Date(start)
      d.setDate(d.getDate() + i)
      buckets.push(dayKey(d))
    }

    // Fetch raw rows within window
    const [{ data: deposits }, { data: withdrawals }, { data: trades }, { data: profiles }] = await Promise.all([
      adminClient.from("deposits").select("amount, status, created_at").gte("created_at", startISO),
      adminClient.from("withdrawals").select("amount, status, created_at").gte("created_at", startISO),
      adminClient.from("trades").select("amount, profit, result, is_demo, symbol, created_at").gte("created_at", startISO),
      adminClient.from("profiles").select("created_at").gte("created_at", startISO),
    ])

    // Initialize per-day maps
    const mk = () => Object.fromEntries(buckets.map((b) => [b, 0])) as Record<string, number>
    const depByDay = mk()
    const depAllByDay = mk()
    const wdByDay = mk()
    const profitByDay = mk()
    const tradesByDay = mk()
    const usersByDay = mk()

    for (const d of deposits || []) {
      const k = dayKey(new Date(d.created_at))
      if (k in depAllByDay) depAllByDay[k] += Number(d.amount || 0)
      if (d.status !== "completed") continue
      if (k in depByDay) depByDay[k] += Number(d.amount || 0)
    }
    for (const w of withdrawals || []) {
      if (w.status !== "completed") continue
      const k = dayKey(new Date(w.created_at))
      if (k in wdByDay) wdByDay[k] += Number(w.amount || 0)
    }
    for (const p of profiles || []) {
      const k = dayKey(new Date(p.created_at))
      if (k in usersByDay) usersByDay[k] += 1
    }

    const symbolCount: Record<string, number> = {}
    let totalWins = 0
    let totalLosses = 0

    for (const t of trades || []) {
      if (t.is_demo) continue
      const k = dayKey(new Date(t.created_at))
      if (k in tradesByDay) tradesByDay[k] += 1
      const res = String(t.result || "").toLowerCase()
      // Platform profit per day = user losses (amount) - user wins (profit)
      if (k in profitByDay) {
        if (res === "loss") profitByDay[k] += Number(t.amount || 0)
        else if (res === "win") profitByDay[k] -= Number(t.profit || 0)
      }
      if (res === "win") totalWins += 1
      else if (res === "loss") totalLosses += 1
      if (t.symbol) symbolCount[t.symbol] = (symbolCount[t.symbol] || 0) + 1
    }

    const labelFor = (k: string) => {
      const d = new Date(k + "T00:00:00")
      return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`
    }

    const cashFlow = buckets.map((b) => ({
      date: labelFor(b),
      depositos: Math.round(depByDay[b] * 100) / 100,
      depositosTotal: Math.round(depAllByDay[b] * 100) / 100,
      saques: Math.round(wdByDay[b] * 100) / 100,
    }))

    const profitSeries = buckets.map((b) => ({
      date: labelFor(b),
      lucro: Math.round(profitByDay[b] * 100) / 100,
    }))

    const activitySeries = buckets.map((b) => ({
      date: labelFor(b),
      trades: tradesByDay[b],
      usuarios: usersByDay[b],
    }))

    const topSymbols = Object.entries(symbolCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([symbol, count]) => ({ symbol: symbol.replace(/_OTC$/, " OTC").replace(/_/g, "/"), count }))

    return NextResponse.json({
      cashFlow,
      profitSeries,
      activitySeries,
      topSymbols,
      winLoss: { wins: totalWins, losses: totalLosses },
    })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error", details: String(error) }, { status: 500 })
  }
}
