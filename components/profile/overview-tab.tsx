"use client"

import Link from "next/link"
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react"
import { KycCard } from "./kyc-card"
import { cn } from "@/lib/utils"
import { useFuturesState } from "@/hooks/use-futures"
import type { AccountMode, Position } from "@/lib/futures/types"
import type { ProfileData } from "./use-profile"

const usd = (n: number) =>
  `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function computeStats(closed: Position[]) {
  const trades = closed.length
  const wins = closed.filter((p) => p.realized_pnl > 0)
  const losses = closed.filter((p) => p.realized_pnl < 0)
  const grossWin = wins.reduce((s, p) => s + p.realized_pnl, 0)
  const grossLoss = Math.abs(losses.reduce((s, p) => s + p.realized_pnl, 0))
  const fees = closed.reduce((s, p) => s + (p.fees_paid ?? 0), 0)
  const net = closed.reduce((s, p) => s + p.realized_pnl, 0)
  const bySymbol = new Map<string, number>()
  closed.forEach((p) => bySymbol.set(p.symbol, (bySymbol.get(p.symbol) ?? 0) + 1))
  const top = [...bySymbol.entries()].sort((a, b) => b[1] - a[1])[0]
  const liquidations = closed.filter((p) => p.status === "liquidated").length
  const avgLev = trades ? closed.reduce((s, p) => s + p.leverage, 0) / trades : 0
  return {
    trades,
    winRate: trades ? (wins.length / trades) * 100 : 0,
    net,
    fees,
    profitFactor: grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? Infinity : 0,
    best: trades ? Math.max(...closed.map((p) => p.realized_pnl)) : 0,
    worst: trades ? Math.min(...closed.map((p) => p.realized_pnl)) : 0,
    topSymbol: top ? `${top[0]} (${top[1]})` : "—",
    liquidations,
    avgLev,
  }
}

function AccountCard({ mode }: { mode: AccountMode }) {
  const { state } = useFuturesState(mode)
  const positions = state?.positions ?? []
  const margin = positions.reduce((s, p) => s + p.margin, 0)
  const stats = computeStats(state?.closedPositions ?? [])
  const balance = state?.balance ?? 0

  const rows: [string, string, string?][] = [
    ["Operações encerradas", String(stats.trades)],
    ["Taxa de acerto", `${stats.winRate.toFixed(1)}%`],
    ["P&L realizado", usd(stats.net), stats.net >= 0 ? "text-long" : "text-short"],
    ["Fator de lucro", Number.isFinite(stats.profitFactor) ? stats.profitFactor.toFixed(2) : "∞"],
    ["Melhor operação", usd(stats.best), "text-long"],
    ["Pior operação", usd(stats.worst), "text-short"],
    ["Taxas pagas", usd(stats.fees)],
    ["Alavancagem média", stats.avgLev ? `${stats.avgLev.toFixed(1)}x` : "—"],
    ["Mercado mais operado", stats.topSymbol],
    ["Liquidações", String(stats.liquidations), stats.liquidations ? "text-short" : undefined],
  ]

  return (
    <section className="flex flex-col gap-4 rounded-md border border-term-line bg-term-panel p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Conta {mode === "real" ? "Real" : "Demo"}</h3>
        <span
          className={cn(
            "rounded px-2 py-0.5 text-[11px] font-medium",
            mode === "real" ? "bg-primary/15 text-primary" : "bg-term-line text-term-muted",
          )}
        >
          {mode === "real" ? "REAL" : "DEMO"}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <p className="text-xs text-term-muted">Saldo disponível</p>
          <p className="font-mono text-lg font-semibold tabular-nums">{usd(balance)}</p>
        </div>
        <div>
          <p className="text-xs text-term-muted">Margem em uso</p>
          <p className="font-mono text-lg tabular-nums">{usd(margin)}</p>
        </div>
        <div>
          <p className="text-xs text-term-muted">Posições abertas</p>
          <p className="font-mono text-lg tabular-nums">{positions.length}</p>
        </div>
      </div>
      <dl className="grid grid-cols-1 gap-x-6 border-t border-term-line pt-3 sm:grid-cols-2">
        {rows.map(([label, value, tone]) => (
          <div key={label} className="flex items-center justify-between py-1.5 text-sm">
            <dt className="text-term-muted">{label}</dt>
            <dd className={cn("font-mono tabular-nums", tone)}>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-term-muted">Estatísticas das últimas 50 posições encerradas.</p>
    </section>
  )
}

export function OverviewTab({ profile }: { profile: ProfileData }) {
  const missing = (
    [
      ["full_name", "Nome completo"],
      ["phone", "Telefone"],
      ["document_number", "Documento"],
      ["birth_date", "Nascimento"],
      ["address_line", "Endereço"],
      ["city", "Cidade"],
    ] as const
  ).filter(([k]) => !profile[k])
  const completion = Math.round(((6 - missing.length) / 6) * 100)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 md:grid-cols-3">
        <KycCard status={profile.kyc_status} isVerified={profile.is_verified} />
        <div className="flex flex-col gap-2 rounded-md border border-term-line bg-term-panel p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Cadastro</p>
            <span className="font-mono text-sm tabular-nums">{completion}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-term-line" role="progressbar" aria-valuenow={completion} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-primary" style={{ width: `${completion}%` }} />
          </div>
          <p className="text-xs text-term-muted text-pretty">
            {missing.length ? `Falta: ${missing.map(([, l]) => l).join(", ")}` : "Cadastro completo"}
          </p>
        </div>
        <div className="flex flex-col gap-2 rounded-md border border-term-line bg-term-panel p-4">
          <p className="text-sm font-semibold">Movimentar saldo</p>
          <div className="flex gap-2">
            <Link
              href="/deposit"
              className="flex flex-1 items-center justify-center gap-1.5 rounded bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              <ArrowDownToLine className="size-4" aria-hidden /> Depositar
            </Link>
            <Link
              href="/withdraw"
              className="flex flex-1 items-center justify-center gap-1.5 rounded bg-term-line px-3 py-2 text-sm font-semibold hover:bg-term-line/70"
            >
              <ArrowUpFromLine className="size-4" aria-hidden /> Sacar
            </Link>
          </div>
          <Link href="/transactions" className="text-xs text-term-muted hover:text-term-text">
            Ver histórico de transações
          </Link>
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <AccountCard mode="real" />
        <AccountCard mode="demo" />
      </div>
    </div>
  )
}
