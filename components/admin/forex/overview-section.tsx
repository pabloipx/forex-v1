"use client"

import { Badge, DataTable, ErrorNote, Panel, Stat, td } from "./ui"
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

const tone = (v: number) => (v > 0 ? "up" : v < 0 ? "down" : undefined)

export function OverviewSection() {
  const { data, error } = useAdminView<Overview>("overview", 3000)

  if (!data) return error ? <ErrorNote error={error} /> : <p className="text-xs text-term-muted">Carregando...</p>

  return (
    <div className="flex flex-col gap-4">
      {data.mode === "test" && (
        <p className="rounded-md border border-primary/30 bg-primary/10 px-4 py-2 text-xs text-primary">
          Modo teste: sem banco configurado, os dados vêm do motor em memória da conta admin@admin.com.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Resultado da casa (aberto)" value={signedUsd(data.houseUpnl)} tone={tone(data.houseUpnl)} hint="Inverso do PnL não realizado dos clientes" />
        <Stat label="Resultado da casa (30d)" value={signedUsd(data.houseResult30)} tone={tone(data.houseResult30)} hint="Perdas dos clientes + taxas" />
        <Stat label="Taxas 24h" value={usd(data.fees24)} tone="accent" hint={`30d: ${usd(data.fees30)}`} />
        <Stat label="Open interest" value={usd(data.openInterest, 0)} hint={`Margem em uso: ${usd(data.marginInUse)}`} />
        <Stat label="Posições abertas (real)" value={String(data.openPositions)} hint={`${data.openOrders} ordens pendentes`} />
        <Stat label="Saldo total dos clientes" value={usd(data.totalRealBalance)} hint="Conta real" />
        <Stat label="Usuários" value={String(data.users)} hint={`${data.blockedUsers} bloqueados · ${data.pendingKyc} KYC pendentes`} />
        <Stat label="Liquidações (30d)" value={String(data.liquidations30)} tone={data.liquidations30 ? "down" : undefined} hint={`PnL clientes 24h: ${signedUsd(data.clientRealized24)}`} />
      </div>

      {data.cash && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            label="Saques a processar"
            value={String(data.cash.pendingWithdrawals)}
            tone={data.cash.pendingWithdrawals ? "accent" : undefined}
            hint={brl(data.cash.pendingWithdrawalsAmount)}
          />
          <Stat label="Depósitos pendentes" value={String(data.cash.pendingDeposits)} tone={data.cash.pendingDeposits ? "accent" : undefined} />
          <Stat label="Depósitos 24h (real)" value={brl(data.cash.deposits24)} tone="up" />
          <Stat label="Saques pagos 24h" value={brl(data.cash.withdrawalsPaid24)} tone="down" />
        </div>
      )}

      <Panel title="Exposição líquida por mercado (conta real)">
        <DataTable
          head={["Mercado", "Posições", "Long (USD)", "Short (USD)", "Líquido (USD)", "Balanço", "PnL clientes", "Risco da casa"]}
          empty={data.exposure.length === 0 && "Nenhuma posição real aberta."}
        >
          {data.exposure.map((e) => {
            const total = e.long + e.short || 1
            const longPct = (e.long / total) * 100
            return (
              <tr key={e.symbol} className="border-b border-term-line/60 last:border-0">
                <td className={cn(td, "font-sans font-semibold")}>
                  {e.symbol} <Badge>{e.category}</Badge>
                </td>
                <td className={td}>{e.count}</td>
                <td className={cn(td, "text-long")}>{usd(e.long, 0)}</td>
                <td className={cn(td, "text-short")}>{usd(e.short, 0)}</td>
                <td className={cn(td, e.net >= 0 ? "text-long" : "text-short")}>{signedUsd(e.net)}</td>
                <td className={td}>
                  <div className="flex h-1.5 w-28 overflow-hidden rounded-full bg-short/60" aria-label={`${longPct.toFixed(0)}% long`}>
                    <div className="h-full bg-long" style={{ width: `${longPct}%` }} />
                  </div>
                </td>
                <td className={cn(td, e.upnl >= 0 ? "text-long" : "text-short")}>{signedUsd(e.upnl)}</td>
                <td className={cn(td, -e.upnl >= 0 ? "text-long" : "text-short")}>{signedUsd(-e.upnl)}</td>
              </tr>
            )
          })}
        </DataTable>
      </Panel>
    </div>
  )
}
