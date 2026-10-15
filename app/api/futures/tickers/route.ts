import { after, NextResponse } from "next/server"
import { getAllTickers, type Ticker } from "@/lib/futures/prices"
import { ensureMarketSettings, withSpread } from "@/lib/futures/market-settings"
import { getDerivatives } from "@/lib/futures/derivatives"
import { sweep } from "@/lib/futures/engine"

export const dynamic = "force-dynamic"

const GLOBAL_SWEEP_MS = 5_000
let lastGlobalSweep = 0
let sweeping = false

// Qualquer tela aberta mantem a varredura global viva (liquidacoes, TP/SL e
// funding de TODAS as contas), limitada a uma execucao a cada 5s por instancia.
function scheduleGlobalSweep() {
  if (sweeping || Date.now() - lastGlobalSweep < GLOBAL_SWEEP_MS) return
  lastGlobalSweep = Date.now()
  sweeping = true
  after(async () => {
    try {
      await sweep()
    } catch (e) {
      console.error("[futures] varredura global falhou:", (e as Error).message)
    } finally {
      sweeping = false
    }
  })
}

export async function GET() {
  try {
    const [raw, settings] = await Promise.all([getAllTickers(), ensureMarketSettings()])
    const tickers: Record<string, Ticker> = {}
    for (const [symbol, t] of Object.entries(raw)) tickers[symbol] = withSpread(t, settings[symbol]?.spreadBps ?? 0)
    const disabled = Object.values(settings)
      .filter((s) => !s.enabled)
      .map((s) => s.symbol)
    const derivatives = await getDerivatives(raw).catch(() => ({}))
    scheduleGlobalSweep()
    return NextResponse.json({ tickers, disabled, derivatives }, { headers: { "Cache-Control": "no-store" } })
  } catch {
    return NextResponse.json({ tickers: {}, disabled: [], derivatives: {} }, { status: 503 })
  }
}
