"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Badge, DataTable, ErrorNote, Panel, SmallButton, inputCls, td } from "./ui"
import { adminAction, dateTime, refreshAdmin, signedUsd, usd, useAdminView } from "./use-admin"
import { cn } from "@/lib/utils"

interface PositionRow {
  id: string
  user_id: string
  email: string
  symbol: string
  side: "long" | "short"
  qty: number
  entry_price: number
  mark: number | null
  leverage: number
  margin: number
  liquidation_price: number | null
  take_profit: number | null
  stop_loss: number | null
  upnl: number
  notional: number
  is_demo: boolean
  opened_at: string
}

interface OrderRow {
  id: string
  user_id: string
  email: string
  symbol: string
  side: "buy" | "sell"
  order_type: string
  price: number | null
  trigger_price: number | null
  qty: number
  leverage: number
  reserved_margin: number
  is_demo: boolean
  created_at: string
}

type Account = "all" | "real" | "demo"

function AccountFilter({ value, onChange }: { value: Account; onChange: (v: Account) => void }) {
  return (
    <div role="radiogroup" aria-label="Conta" className="flex gap-1">
      {(["all", "real", "demo"] as const).map((k) => (
        <button
          key={k}
          role="radio"
          aria-checked={value === k}
          onClick={() => onChange(k)}
          className={cn("rounded px-2 py-1 text-xs", value === k ? "bg-term-line text-term-text" : "text-term-muted hover:text-term-text")}
        >
          {k === "all" ? "Todas" : k === "real" ? "Real" : "Demo"}
        </button>
      ))}
    </div>
  )
}

export function PositionsSection() {
  const positions = useAdminView<PositionRow[]>("positions", 2000)
  const orders = useAdminView<OrderRow[]>("orders", 4000)
  const [account, setAccount] = useState<Account>("real")
  const [query, setQuery] = useState("")
  const [busy, setBusy] = useState<string | null>(null)

  const match = (r: { is_demo: boolean; email: string; symbol: string }) =>
    (account === "all" || (account === "demo") === r.is_demo) &&
    (!query || r.email.toLowerCase().includes(query.toLowerCase()) || r.symbol.toLowerCase().includes(query.toLowerCase()))

  const run = async (id: string, body: Record<string, unknown>, ok: string) => {
    setBusy(id)
    try {
      await adminAction(body)
      await refreshAdmin("positions", "orders", "overview")
      toast.success(ok)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const pos = (positions.data ?? []).filter(match)
  const ord = (orders.data ?? []).filter(match)
  const totalUpnl = pos.reduce((s, p) => s + p.upnl, 0)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Filtrar por e-mail ou mercado"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={cn(inputCls, "max-w-xs font-sans")}
          aria-label="Filtrar posições"
        />
        <AccountFilter value={account} onChange={setAccount} />
      </div>

      <Panel
        title={`Posições abertas (${pos.length})`}
        action={
          <span className={cn("font-mono text-xs", totalUpnl >= 0 ? "text-long" : "text-short")}>PnL clientes {signedUsd(totalUpnl)}</span>
        }
      >
        <ErrorNote error={positions.error} />
        <DataTable
          head={["Cliente", "Mercado", "Lado", "Qtd", "Entrada", "Marca", "Liq.", "TP / SL", "Margem", "Nocional", "PnL", "Aberta", ""]}
          empty={pos.length === 0 && "Nenhuma posição aberta."}
        >
          {pos.map((p) => (
            <tr key={p.id} className="border-b border-term-line/60 last:border-0">
              <td className={cn(td, "font-sans")}>
                {p.email} {p.is_demo && <Badge>demo</Badge>}
              </td>
              <td className={cn(td, "font-sans font-semibold")}>{p.symbol}</td>
              <td className={td}>
                <Badge tone={p.side === "long" ? "up" : "down"}>
                  {p.side === "long" ? "Long" : "Short"} {p.leverage}x
                </Badge>
              </td>
              <td className={td}>{p.qty}</td>
              <td className={td}>{p.entry_price}</td>
              <td className={td}>{p.mark ?? "—"}</td>
              <td className={cn(td, "text-primary")}>{p.liquidation_price ? Number(p.liquidation_price).toPrecision(6) : "—"}</td>
              <td className={td}>
                <span className="text-long">{p.take_profit ?? "—"}</span> / <span className="text-short">{p.stop_loss ?? "—"}</span>
              </td>
              <td className={td}>{usd(Number(p.margin))}</td>
              <td className={td}>{usd(p.notional, 0)}</td>
              <td className={cn(td, p.upnl >= 0 ? "text-long" : "text-short")}>{signedUsd(p.upnl)}</td>
              <td className={cn(td, "text-term-muted")}>{dateTime(p.opened_at)}</td>
              <td className={td}>
                <SmallButton
                  tone="down"
                  disabled={busy === p.id}
                  onClick={() => run(p.id, { action: "close_position", userId: p.user_id, positionId: p.id }, `Posição ${p.symbol} fechada a mercado`)}
                >
                  Fechar
                </SmallButton>
              </td>
            </tr>
          ))}
        </DataTable>
      </Panel>

      <Panel title={`Ordens pendentes (${ord.length})`}>
        <ErrorNote error={orders.error} />
        <DataTable
          head={["Cliente", "Mercado", "Lado", "Tipo", "Preço / gatilho", "Qtd", "Alav.", "Margem reservada", "Criada", ""]}
          empty={ord.length === 0 && "Nenhuma ordem pendente."}
        >
          {ord.map((o) => (
            <tr key={o.id} className="border-b border-term-line/60 last:border-0">
              <td className={cn(td, "font-sans")}>
                {o.email} {o.is_demo && <Badge>demo</Badge>}
              </td>
              <td className={cn(td, "font-sans font-semibold")}>{o.symbol}</td>
              <td className={td}>
                <Badge tone={o.side === "buy" ? "up" : "down"}>{o.side === "buy" ? "Compra" : "Venda"}</Badge>
              </td>
              <td className={cn(td, "font-sans")}>{o.order_type === "limit" ? "Limitada" : o.order_type === "conditional" ? "Condicional" : "Mercado"}</td>
              <td className={td}>{o.price ?? o.trigger_price ?? "—"}</td>
              <td className={td}>{o.qty}</td>
              <td className={td}>{o.leverage}x</td>
              <td className={td}>{usd(Number(o.reserved_margin))}</td>
              <td className={cn(td, "text-term-muted")}>{dateTime(o.created_at)}</td>
              <td className={td}>
                <SmallButton
                  disabled={busy === o.id}
                  onClick={() => run(o.id, { action: "cancel_order", userId: o.user_id, orderId: o.id }, "Ordem cancelada")}
                >
                  Cancelar
                </SmallButton>
              </td>
            </tr>
          ))}
        </DataTable>
      </Panel>
    </div>
  )
}
