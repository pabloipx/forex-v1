"use client"

import { useState } from "react"
import { ArrowLeftRight } from "lucide-react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import {
  MAINTENANCE_MARGIN_RATE,
  MARKET_MAP,
  formatUsd,
  notionalUsd,
  unrealizedPnl,
} from "@/lib/futures/markets"
import type { AccountMode, FuturesState } from "@/lib/futures/types"
import { futuresApi, type DerivativesInfo } from "@/hooks/use-futures"

type Direction = "spot_to_futures" | "futures_to_spot"

export function computeAccountMetrics(state: FuturesState | undefined, derivs: Record<string, DerivativesInfo>) {
  const positions = state?.positions ?? []
  let usedMargin = 0
  let upnl = 0
  let maintenance = 0
  for (const p of positions) {
    const market = MARKET_MAP[p.symbol]
    if (!market) continue
    const mark = derivs[p.symbol]?.markPrice ?? p.entry_price
    usedMargin += p.margin
    upnl += unrealizedPnl(market, p.side, p.qty, p.entry_price, mark)
    maintenance += notionalUsd(market, p.qty, mark) * MAINTENANCE_MARGIN_RATE
  }
  const orderMargin = (state?.openOrders ?? []).reduce((s, o) => s + (o.reserved_margin || 0), 0)
  const available = state?.balance ?? 0
  const equity = available + usedMargin + orderMargin + upnl
  const risk = equity > 0 ? maintenance / equity : positions.length ? 1 : 0
  return { equity, usedMargin, orderMargin, available, upnl, maintenance, risk }
}

function TransferDialog({
  open,
  onOpenChange,
  spot,
  futures,
  onDone,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  spot: number
  futures: number
  onDone: () => void
}) {
  const [direction, setDirection] = useState<Direction>("spot_to_futures")
  const [amount, setAmount] = useState("")
  const [busy, setBusy] = useState(false)
  const from = direction === "spot_to_futures" ? spot : futures
  const value = Number(amount) || 0

  const submit = async () => {
    setBusy(true)
    try {
      await futuresApi.transfer(direction, value)
      toast.success(`Transferência de ${formatUsd(value)} USD concluída`)
      setAmount("")
      onDone()
      onOpenChange(false)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const wallet = (label: string, balance: number) => (
    <div className="flex flex-1 flex-col gap-0.5 rounded-md bg-term-bg px-3 py-2">
      <span className="text-[11px] text-term-muted">{label}</span>
      <span className="font-mono text-sm text-term-text">{formatUsd(balance)} USD</span>
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-term-line bg-term-panel text-term-text sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Transferir entre carteiras</DialogTitle>
          <DialogDescription className="text-term-muted">
            Transferências internas são instantâneas e sem taxa.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2">
          {direction === "spot_to_futures" ? wallet("De: Spot", spot) : wallet("De: Futuros", futures)}
          <button
            onClick={() => setDirection((d) => (d === "spot_to_futures" ? "futures_to_spot" : "spot_to_futures"))}
            className="rounded-full bg-term-line p-2 text-term-text hover:bg-primary hover:text-primary-foreground"
            aria-label="Inverter direção"
          >
            <ArrowLeftRight className="size-4" aria-hidden="true" />
          </button>
          {direction === "spot_to_futures" ? wallet("Para: Futuros", futures) : wallet("Para: Spot", spot)}
        </div>
        <label className="flex items-center gap-2 rounded-md border border-transparent bg-term-bg px-3 py-2 focus-within:border-primary">
          <span className="text-xs text-term-muted">Valor</span>
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(",", ".").replace(/[^0-9.]/g, ""))}
            className="w-full bg-transparent text-right font-mono text-sm outline-none"
            placeholder="0.00"
          />
          <button onClick={() => setAmount(String(Math.floor(from * 100) / 100))} className="text-xs font-semibold text-primary">
            Máx
          </button>
        </label>
        <button
          disabled={busy || value <= 0 || value > from}
          onClick={submit}
          className="rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40"
        >
          {busy ? "Transferindo..." : value > from ? "Saldo insuficiente" : "Confirmar transferência"}
        </button>
      </DialogContent>
    </Dialog>
  )
}

export function AccountSummary({
  state,
  account,
  derivs,
  onChanged,
}: {
  state: FuturesState | undefined
  account: AccountMode
  derivs: Record<string, DerivativesInfo>
  onChanged: () => void
}) {
  const [transferOpen, setTransferOpen] = useState(false)
  if (!state?.authenticated) return null
  const m = computeAccountMetrics(state, derivs)
  const riskPct = Math.min(m.risk * 100, 100)
  const riskTone = riskPct >= 80 ? "text-short" : riskPct >= 50 ? "text-primary" : "text-long"
  const barTone = riskPct >= 80 ? "bg-short" : riskPct >= 50 ? "bg-primary" : "bg-long"

  const row = (label: string, value: string, className?: string) => (
    <div className="flex justify-between">
      <dt className="text-term-muted">{label}</dt>
      <dd className={cn("font-mono text-term-text", className)}>{value}</dd>
    </div>
  )

  return (
    <section aria-label="Margem da conta" className="flex flex-col gap-3 border-t border-term-line bg-term-panel p-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-term-text">Conta</h2>
        {account === "real" && (
          <button onClick={() => setTransferOpen(true)} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            <ArrowLeftRight className="size-3.5" aria-hidden="true" />
            Transferir
          </button>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-term-muted">Índice de risco</span>
          <span className={cn("font-mono font-semibold", riskTone)}>{riskPct.toFixed(2)}%</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-term-bg" role="meter" aria-valuenow={riskPct} aria-valuemin={0} aria-valuemax={100} aria-label="Índice de risco">
          <div className={cn("h-full rounded-full transition-all", barTone)} style={{ width: `${Math.max(riskPct, 1)}%` }} />
        </div>
      </div>
      <dl className="flex flex-col gap-1 text-xs">
        {row("Patrimônio", `${formatUsd(m.equity)} USD`)}
        {row("PnL não realizado", `${m.upnl >= 0 ? "+" : ""}${formatUsd(m.upnl)} USD`, m.upnl >= 0 ? "text-long" : "text-short")}
        {row("Margem usada", `${formatUsd(m.usedMargin + m.orderMargin)} USD`)}
        {row("Margem de manutenção", `${formatUsd(m.maintenance)} USD`)}
        {row("Margem disponível", `${formatUsd(m.available)} USD`)}
        {account === "real" && row("Carteira Spot", `${formatUsd(state.spotBalance ?? 0)} USD`)}
      </dl>
      <TransferDialog
        open={transferOpen}
        onOpenChange={setTransferOpen}
        spot={state.spotBalance ?? 0}
        futures={state.balances.real}
        onDone={onChanged}
      />
    </section>
  )
}
