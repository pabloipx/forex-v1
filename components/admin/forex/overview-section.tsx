"use client"

import type { ReactNode } from "react"
import { ArrowDownToLine, ArrowUpFromLine, Clock, ShieldAlert, Users, Wallet } from "lucide-react"
import { Badge, ErrorNote, Panel } from "./ui"
import { brl, signedUsd, usd, useAdminView } from "./use-admin"
import { cn } from "@/lib/utils"

interface Overview {
  mode: "test" | "database"
  users: number
  blockedUsers: number
  pendingKyc: number
  totalRealBalance: number
  openPositions: number
  openOrders: number
  openInterest: number
  marginInUse: number
  clientUpnl: number
  houseUpnl: number
  clientRealized24: number
  fees24: number
  clientRealized30: number
  fees30: number
  houseResult30: number
  liquidations30: number
  cash: {
    pendingWithdrawals: number
    pendingWithdrawalsAmount: number
    pendingDeposits: number
    deposits24: number
    withdrawalsPaid24: number
  } | null
  exposure: { symbol: string; category: string; long: number; short: number; net: number; upnl: number; count: number }[]
}

const toneCls = (v: number) => (v > 0 ? "text-long" : v < 0 ? "text-short" : "text-term-text")

function Kpi({ label, value, hint, className }: { label: string; value: string; hint?: string; className?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="truncate text-[11px] uppercase tracking-wide text-term-muted">{label}</span>
      <span className={cn("truncate font-mono text-lg font-semibold tabular-nums", className)}>{value}</span>
      {hint && <span className="truncate text-xs text-term-muted">{hint}</span>}
    </div>
  )
}

function HouseHero({ data }: { data: Overview }) {
  const exposureTotal = data.exposure.reduce((s, e) => s + e.long + e.short, 0) || 1
  const longTotal = data.exposure.reduce((s, e) => s + e.long, 0)
  const longPct = (longTotal / exposureTotal) * 100

  return (
    <section aria-labelledby="house-title" className="flex flex-col gap-5 rounded-2xl border border-term-line bg-term-panel p-5 md:p-6">
      <div className="flex flex-col gap-1">
        <h2 id="house-title" className="text-xs font-medium uppercase tracking-wider text-term-muted">
          Resultado da casa · 30 dias
        </h2>
        <p className={cn("font-mono text-4xl font-bold tabular-nums tracking-tight md:text-5xl", toneCls(data.houseResult30))}>
          {signedUsd(data.houseResult30)}
        </p>
        <p className="text-sm text-term-muted">
          Em aberto agora: <span className={cn("font-mono tabular-nums", toneCls(data.houseUpnl))}>{signedUsd(data.houseUpnl)}</span>
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs text-term-muted">
          <span>Long {longPct.toFixed(0)}%</span>
          <span>Open interest {usd(data.openInterest, 0)}</span>
          <span>Short {(100 - longPct).toFixed(0)}%</span>
        </div>
        <div className="flex h-2 overflow-hidden rounded-full bg-short/70" role="img" aria-label={`${longPct.toFixed(0)}% da exposição em long`}>
          <div className="h-full bg-long transition-[width] duration-700" style={{ width: `${data.exposure.length ? longPct : 50}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 border-t border-term-line pt-5 md:grid-cols-4">
        <Kpi label="Taxas 24h" value={usd(data.fees24)} hint={`30d: ${usd(data.fees30)}`} className="text-primary" />
        <Kpi label="Margem em uso" value={usd(data.marginInUse)} hint={`${data.openPositions} posições reais`} />
        <Kpi label="PnL clientes 24h" value={signedUsd(data.clientRealized24)} className={toneCls(data.clientRealized24)} hint={`${data.openOrders} ordens pendentes`} />
        <Kpi
          label="Liquidações 30d"
          value={String(data.liquidations30)}
          className={data.liquidations30 ? "text-short" : undefined}
          hint={`PnL 30d: ${signedUsd(data.clientRealized30)}`}
        />
      </div>
    </section>
  )
}

function Tile({ icon, label, value, hint, highlight }: { icon: ReactNode; label: string; value: string; hint?: string; highlight?: boolean }) {
  return (
    <div className={cn("flex items-start gap-3 rounded-xl border bg-term-panel p-4", highlight ? "border-primary/40" : "border-term-line")}>
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", highlight ? "bg-primary/15 text-primary" : "bg-term-line text-term-muted")}>
        {icon}
      </span>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-xs text-term-muted">{label}</span>
        <span className="truncate font-mono text-base font-semibold tabular-nums">{value}</span>
        {hint && <span className="truncate text-xs text-term-muted">{hint}</span>}
      </div>
    </div>
  )
}

function CashFlow({ cash }: { cash: NonNullable<Overview["cash"]> }) {
  const max = Math.max(cash.deposits24, cash.withdrawalsPaid24, 1)
  const net = cash.deposits24 - cash.withdrawalsPaid24
  const Row = ({ label, value, cls }: { label: string; value: number; cls: string }) => (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-term-muted">{label}</span>
        <span className="font-mono tabular-nums">{brl(value)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-term-line">
        <div className={cn("h-full rounded-full transition-[width] duration-700", cls)} style={{ width: `${(value / max) * 100}%` }} />
      </div>
    </div>
  )
  return (
    <Panel title="Fluxo de caixa · 24h" action={<span className={cn("font-mono text-sm font-semibold tabular-nums", toneCls(net))}>{`${net >= 0 ? "+" : ""}${brl(net)}`}</span>}>
      <div className="flex flex-col gap-4 p-4">
        <Row label="Depósitos (PIX/cripto)" value={cash.deposits24} cls="bg-long" />
        <Row label="Saques pagos" value={cash.withdrawalsPaid24} cls="bg-short" />
      </div>
    </Panel>
  )
}

function Exposure({ rows }: { rows: Overview["exposure"] }) {
  return (
    <Panel title="Exposição por mercado" action={<span className="text-xs text-term-muted">Conta real</span>}>
      {rows.length === 0 ? (
        <p className="px-4 py-10 text-center text-sm text-term-muted">Nenhuma posição real aberta.</p>
      ) : (
        <ul className="divide-y divide-term-line/60">
          {rows.map((e) => {
            const total = e.long + e.short || 1
            const longPct = (e.long / total) * 100
            return (
              <li key={e.symbol} className="flex flex-col gap-2.5 px-4 py-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-semibold">{e.symbol}</span>
                    <Badge>{e.category}</Badge>
                    <span className="text-xs text-term-muted">{e.count} pos.</span>
                  </div>
                  <span className={cn("shrink-0 font-mono text-sm font-semibold tabular-nums", toneCls(-e.upnl))} title="Resultado da casa neste mercado">
                    {signedUsd(-e.upnl)}
                  </span>
                </div>
                <div className="flex h-1.5 overflow-hidden rounded-full bg-short/70" aria-label={`${longPct.toFixed(0)}% long`}>
                  <div className="h-full bg-long" style={{ width: `${longPct}%` }} />
                </div>
                <div className="flex items-center justify-between font-mono text-xs tabular-nums text-term-muted">
                  <span className="text-long">L {usd(e.long, 0)}</span>
                  <span>Líquido {signedUsd(e.net)}</span>
                  <span className="text-short">S {usd(e.short, 0)}</span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}

export function OverviewSection() {
  const { data, error } = useAdminView<Overview>("overview", 3000)

  if (!data) return error ? <ErrorNote error={error} /> : <p className="text-sm text-term-muted">Carregando...</p>

  return (
    <div className="flex flex-col gap-4 md:gap-5">
      {data.mode === "test" && (
        <p className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-2.5 text-xs leading-relaxed text-primary">
          Modo teste: sem banco configurado, os dados vêm do motor em memória da conta admin@admin.com.
        </p>
      )}

      <HouseHero data={data} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile icon={<Wallet className="size-4" aria-hidden />} label="Saldo dos clientes" value={usd(data.totalRealBalance)} hint="Conta real" />
        <Tile
          icon={<Users className="size-4" aria-hidden />}
          label="Usuários"
          value={String(data.users)}
          hint={`${data.blockedUsers} bloqueados`}
        />
        <Tile
          icon={<ShieldAlert className="size-4" aria-hidden />}
          label="KYC pendentes"
          value={String(data.pendingKyc)}
          hint="Aguardando análise"
          highlight={data.pendingKyc > 0}
        />
        {data.cash && (
          <Tile
            icon={<Clock className="size-4" aria-hidden />}
            label="Saques a processar"
            value={String(data.cash.pendingWithdrawals)}
            hint={brl(data.cash.pendingWithdrawalsAmount)}
            highlight={data.cash.pendingWithdrawals > 0}
          />
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5 md:gap-5">
        <div className="flex flex-col gap-4 lg:col-span-2">
          {data.cash && <CashFlow cash={data.cash} />}
          {data.cash && (
            <div className="grid grid-cols-2 gap-3">
              <Tile icon={<ArrowDownToLine className="size-4" aria-hidden />} label="Depósitos pendentes" value={String(data.cash.pendingDeposits)} />
              <Tile icon={<ArrowUpFromLine className="size-4" aria-hidden />} label="Saques pagos 24h" value={brl(data.cash.withdrawalsPaid24)} />
            </div>
          )}
        </div>
        <div className="lg:col-span-3">
          <Exposure rows={data.exposure} />
        </div>
      </div>
    </div>
  )
}
