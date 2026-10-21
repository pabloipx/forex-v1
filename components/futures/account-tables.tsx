"use client"

import { useState, type ReactNode } from "react"
import { toast } from "sonner"
import { Pencil } from "lucide-react"
import { Slider } from "@/components/ui/slider"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import {
  MARKET_MAP,
  formatPrice,
  formatUsd,
  notionalUsd,
  parseDecimalInput,
  sanitizeDecimalInput,
  tpSlError,
  unrealizedPnl,
} from "@/lib/futures/markets"
import type { AccountMode, FuturesState, Order, Position } from "@/lib/futures/types"
import { futuresApi, type DerivativesInfo, type Ticker } from "@/hooks/use-futures"

interface AccountTablesProps {
  state: FuturesState | undefined
  account: AccountMode
  marks: Record<string, Ticker>
  derivs?: Record<string, DerivativesInfo>
  liveSymbol: string
  livePrice: number | null
  onChanged: () => void
}

type Tab = "positions" | "orders" | "history" | "fills" | "pnl" | "funding"

const ORDER_TYPE: Record<string, string> = { market: "Mercado", limit: "Limitada", conditional: "Condicional" }
const STATUS: Record<string, string> = {
  open: "Aberta",
  filled: "Executada",
  cancelled: "Cancelada",
  rejected: "Rejeitada",
}
const CLOSE_REASON: Record<string, string> = {
  manual: "Manual",
  take_profit: "Take Profit",
  stop_loss: "Stop Loss",
  liquidation: "Liquidação",
  trailing_stop: "Trailing stop",
  reduce: "Ordem",
}

const time = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })

function Th({ children, right }: { children: ReactNode; right?: boolean }) {
  return (
    <th scope="col" className={cn("whitespace-nowrap px-3 py-2 font-normal text-term-muted", right ? "text-right" : "text-left")}>
      {children}
    </th>
  )
}
function Td({ children, right, className }: { children: ReactNode; right?: boolean; className?: string }) {
  return <td className={cn("whitespace-nowrap px-3 py-2 font-mono", right && "text-right", className)}>{children}</td>
}

function Empty({ text }: { text: string }) {
  return <p className="py-10 text-center text-xs text-term-muted">{text}</p>
}

function SideLabel({ side }: { side: "long" | "short" | "buy" | "sell" }) {
  const isLong = side === "long" || side === "buy"
  const label = side === "long" ? "Long" : side === "short" ? "Short" : side === "buy" ? "Compra" : "Venda"
  return <span className={isLong ? "text-long" : "text-short"}>{label}</span>
}

function TpSlDialog({
  position,
  livePrice,
  onClose,
  onSaved,
}: {
  position: Position
  livePrice: number | null
  onClose: () => void
  onSaved: () => void
}) {
  const market = MARKET_MAP[position.symbol]
  const [tp, setTp] = useState(position.take_profit?.toString() ?? "")
  const [sl, setSl] = useState(position.stop_loss?.toString() ?? "")
  const [trail, setTrail] = useState(position.trailing_distance?.toString() ?? "")
  const [saving, setSaving] = useState(false)

  const save = async () => {
    const ref = livePrice ?? position.entry_price
    const tpNum = tp ? parseDecimalInput(tp, ref) : null
    const slNum = sl ? parseDecimalInput(sl, ref) : null
    const trailNum = trail ? parseDecimalInput(trail) : null
    if ([tpNum, slNum, trailNum].some((n) => n != null && !(Number.isFinite(n) && n > 0))) {
      toast.error("Informe valores válidos")
      return
    }
    const message = tpSlError(
      position.side === "long" ? "buy" : "sell",
      ref,
      tpNum,
      slNum,
      market?.priceDecimals ?? 2,
      livePrice != null ? "preço atual" : "preço de entrada",
    )
    if (message) {
      toast.error(message)
      return
    }
    setSaving(true)
    try {
      await futuresApi.setTpSl(position.id, tpNum, slNum)
      const nextTrail = trailNum
      if (nextTrail !== (position.trailing_distance ?? null)) await futuresApi.setTrailing(position.id, nextTrail)
      toast.success("TP/SL atualizado")
      onSaved()
      onClose()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const input = (label: string, value: string, set: (v: string) => void) => (
    <label className="flex items-center gap-2 rounded-md bg-term-bg px-3 py-2 focus-within:ring-1 focus-within:ring-primary">
      <span className="w-24 text-xs text-term-muted">{label}</span>
      <input
        inputMode="decimal"
        value={value}
        onChange={(e) => set(sanitizeDecimalInput(e.target.value))}
        placeholder="Não definido"
        className="w-full bg-transparent text-right font-mono text-sm text-term-text outline-none placeholder:text-term-muted"
      />
    </label>
  )

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="border-term-line bg-term-panel text-term-text sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>TP/SL · {position.symbol}</DialogTitle>
          <DialogDescription className="text-term-muted">
            Entrada {formatPrice(position.entry_price, market?.priceDecimals ?? 2)} · Liquidação{" "}
            {formatPrice(position.liquidation_price, market?.priceDecimals ?? 2)}
          </DialogDescription>
        </DialogHeader>
        {input("Take Profit", tp, setTp)}
        {input("Stop Loss", sl, setSl)}
        {input("Trailing stop", trail, setTrail)}
        <p className="text-[11px] leading-relaxed text-term-muted">
          Trailing stop: distância em preço ({market?.quote ?? "USDT"}) a partir do melhor preço atingido. O stop acompanha o
          mercado a favor e fecha a posição se o preço recuar essa distância.
          {position.trailing_peak ? ` Melhor preço atual: ${formatPrice(position.trailing_peak, market?.priceDecimals ?? 2)}.` : ""}
        </p>
        <button
          onClick={save}
          disabled={saving}
          className="rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {saving ? "Salvando..." : "Confirmar"}
        </button>
      </DialogContent>
    </Dialog>
  )
}

function LeverageDialog({ position, onClose, onSaved }: { position: Position; onClose: () => void; onSaved: () => void }) {
  const market = MARKET_MAP[position.symbol]
  const max = market?.maxLeverage ?? 100
  const [lev, setLev] = useState(position.leverage)
  const [saving, setSaving] = useState(false)
  const newMargin = (position.margin * position.leverage) / lev
  const delta = newMargin - position.margin

  const save = async () => {
    setSaving(true)
    try {
      await futuresApi.setLeverage(position.id, lev)
      toast.success(`Alavancagem ajustada para ${lev}x`)
      onSaved()
      onClose()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="border-term-line bg-term-panel text-term-text sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Ajustar alavancagem · {position.symbol}</DialogTitle>
          <DialogDescription className="text-term-muted">
            A margem da posição é recalculada e o preço de liquidação muda.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center justify-between">
          <span className="text-sm text-term-muted">Alavancagem</span>
          <span className="font-mono text-2xl font-semibold text-term-text">{lev}x</span>
        </div>
        <Slider min={1} max={max} step={1} value={[lev]} onValueChange={([v]) => setLev(v)} aria-label="Alavancagem" />
        <div className="flex justify-between font-mono text-[11px] text-term-muted">
          <span>1x</span>
          <span>{max}x</span>
        </div>
        <dl className="flex flex-col gap-1 text-xs">
          <div className="flex justify-between">
            <dt className="text-term-muted">Margem atual</dt>
            <dd className="font-mono">{formatUsd(position.margin)}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-term-muted">Nova margem</dt>
            <dd className="font-mono">
              {formatUsd(newMargin)}{" "}
              <span className={delta > 0 ? "text-short" : "text-long"}>
                ({delta > 0 ? "+" : ""}
                {formatUsd(delta)})
              </span>
            </dd>
          </div>
        </dl>
        {lev >= 50 && (
          <p className="rounded-md bg-short/10 p-2 text-xs leading-relaxed text-short">
            Alavancagem alta: uma variação pequena no preço de marcação pode liquidar a posição.
          </p>
        )}
        <button
          onClick={save}
          disabled={saving || lev === position.leverage}
          className="rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {saving ? "Salvando..." : "Confirmar"}
        </button>
      </DialogContent>
    </Dialog>
  )
}

function PositionRow({
  p,
  mark,
  onChanged,
  onEditTpSl,
  onEditLeverage,
}: {
  p: Position
  mark: number | null
  onChanged: () => void
  onEditTpSl: () => void
  onEditLeverage: () => void
}) {
  const market = MARKET_MAP[p.symbol]
  const [limitPrice, setLimitPrice] = useState("")
  const [busy, setBusy] = useState(false)
  if (!market) return null
  const d = market.priceDecimals
  const pnl = mark != null ? unrealizedPnl(market, p.side, p.qty, p.entry_price, mark) : 0
  const roi = p.margin > 0 ? (pnl / p.margin) * 100 : 0

  const close = async (price?: number) => {
    setBusy(true)
    try {
      await futuresApi.closePosition(p.id, undefined, price)
      toast.success(price ? "Ordem de fechamento enviada" : `Posição ${p.symbol} fechada`)
      setLimitPrice("")
      onChanged()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <tr className="border-t border-term-line/60 hover:bg-term-line/30">
      <Td className="font-sans">
        <span className="flex flex-col leading-tight">
          <span className="font-semibold text-term-text">{p.symbol}</span>
          <span className="text-[11px]">
            <SideLabel side={p.side} /> <button
              onClick={onEditLeverage}
              className="inline-flex items-center gap-1 text-term-muted hover:text-primary"
            >
              {p.margin_mode === "cross" ? "Cruzada" : "Isolada"} {p.leverage}x
              <Pencil className="size-2.5" aria-hidden="true" />
              <span className="sr-only">Ajustar alavancagem</span>
            </button>
          </span>
        </span>
      </Td>
      <Td right className={p.side === "long" ? "text-long" : "text-short"}>
        {p.qty.toFixed(market.qtyDecimals)} {market.qtyUnit}
      </Td>
      <Td right className="text-term-text">{formatUsd(mark != null ? notionalUsd(market, p.qty, mark) : null)}</Td>
      <Td right className="text-term-text">{formatPrice(p.entry_price, d)}</Td>
      <Td right className="text-term-text">{formatPrice(mark, d)}</Td>
      <Td right className="text-primary">{formatPrice(p.liquidation_price, d)}</Td>
      <Td right className="text-term-text">{formatUsd(p.margin)}</Td>
      <Td right className={pnl >= 0 ? "text-long" : "text-short"}>
        {pnl >= 0 ? "+" : ""}
        {formatUsd(pnl)} ({roi >= 0 ? "+" : ""}
        {roi.toFixed(2)}%)
      </Td>
      <Td right className="text-term-text">
        <button onClick={onEditTpSl} className="inline-flex items-center gap-1 hover:text-primary">
          <span>
            {p.take_profit ? formatPrice(p.take_profit, d) : "--"} / {p.stop_loss ? formatPrice(p.stop_loss, d) : "--"}
          </span>
          <Pencil className="size-3" aria-hidden="true" />
          <span className="sr-only">Editar TP/SL</span>
        </button>
      </Td>
      <Td right className="font-sans">
        <span className="flex items-center justify-end gap-1.5">
          <button
            disabled={busy}
            onClick={() => close()}
            className="rounded bg-term-line px-2 py-1 text-xs font-semibold text-term-text hover:bg-term-muted/30 disabled:opacity-60"
          >
            Mercado
          </button>
          <input
            aria-label="Preço limite de fechamento"
            inputMode="decimal"
            value={limitPrice}
            onChange={(e) => setLimitPrice(e.target.value.replace(",", ".").replace(/[^0-9.]/g, ""))}
            placeholder="Preço"
            className="w-20 rounded bg-term-bg px-2 py-1 text-right font-mono text-xs text-term-text outline-none placeholder:text-term-muted"
          />
          <button
            disabled={busy || !Number(limitPrice)}
            onClick={() => close(Number(limitPrice))}
            className="rounded bg-term-line px-2 py-1 text-xs font-semibold text-term-text hover:bg-term-muted/30 disabled:opacity-60"
          >
            Limite
          </button>
        </span>
      </Td>
    </tr>
  )
}

function OrdersTable({ orders, onCancel }: { orders: Order[]; onCancel?: (id: string) => void }) {
  return (
    <table className="w-full text-xs">
      <thead>
        <tr>
          <Th>Contrato</Th>
          <Th>Tipo</Th>
          <Th>Lado</Th>
          <Th right>Preço</Th>
          <Th right>Disparo</Th>
          <Th right>Qtd</Th>
          <Th right>{onCancel ? "Margem reservada" : "Preço médio"}</Th>
          <Th right>{onCancel ? "TP/SL" : "Status"}</Th>
          <Th right>Hora</Th>
          {onCancel && <Th right>Ação</Th>}
        </tr>
      </thead>
      <tbody>
        {orders.map((o) => {
          const m = MARKET_MAP[o.symbol]
          const d = m?.priceDecimals ?? 2
          return (
            <tr key={o.id} className="border-t border-term-line/60 text-term-text hover:bg-term-line/30">
              <Td className="font-sans font-semibold">
                {o.symbol}
                {o.reduce_only && <span className="ml-1.5 text-[10px] font-normal text-primary">Reduzir</span>}
              </Td>
              <Td className="font-sans">{ORDER_TYPE[o.order_type]}</Td>
              <Td className="font-sans">
                <SideLabel side={o.side} />
              </Td>
              <Td right>{o.price ? formatPrice(o.price, d) : "Mercado"}</Td>
              <Td right>{o.trigger_price ? `${o.trigger_direction === "rise" ? "≥" : "≤"} ${formatPrice(o.trigger_price, d)}` : "--"}</Td>
              <Td right>{o.qty.toFixed(m?.qtyDecimals ?? 3)}</Td>
              <Td right>{onCancel ? formatUsd(o.reserved_margin) : formatPrice(o.filled_price, d)}</Td>
              <Td right className="font-sans">
                {onCancel ? (
                  `${o.take_profit ? formatPrice(o.take_profit, d) : "--"} / ${o.stop_loss ? formatPrice(o.stop_loss, d) : "--"}`
                ) : (
                  <span
                    title={o.reject_reason ?? undefined}
                    className={cn(o.status === "filled" && "text-long", o.status === "rejected" && "text-short", o.status === "cancelled" && "text-term-muted")}
                  >
                    {STATUS[o.status]}
                  </span>
                )}
              </Td>
              <Td right className="text-term-muted">{time(o.created_at)}</Td>
              {onCancel && (
                <Td right className="font-sans">
                  <button onClick={() => onCancel(o.id)} className="text-primary hover:underline">
                    Cancelar
                  </button>
                </Td>
              )}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export function AccountTables({ state, account, marks, derivs, liveSymbol, livePrice, onChanged }: AccountTablesProps) {
  const [tab, setTab] = useState<Tab>("positions")
  const [editing, setEditing] = useState<Position | null>(null)
  const [editingLev, setEditingLev] = useState<Position | null>(null)
  const [closingAll, setClosingAll] = useState(false)
  const positions = state?.positions ?? []
  const openOrders = state?.openOrders ?? []
  const funding = state?.fundingHistory ?? []

  // PnL e risco usam o preço de marcação; o último negócio é só fallback.
  const markOf = (symbol: string) =>
    derivs?.[symbol]?.markPrice ?? (symbol === liveSymbol && livePrice ? livePrice : (marks[symbol]?.price ?? null))

  const closeAll = async () => {
    if (!window.confirm(`Fechar todas as ${positions.length} posições a mercado?`)) return
    setClosingAll(true)
    try {
      await futuresApi.closeAll(account)
      toast.success("Todas as posições foram fechadas")
      onChanged()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setClosingAll(false)
    }
  }

  const cancel = async (id: string) => {
    try {
      await futuresApi.cancelOrder(id)
      toast.success("Ordem cancelada")
      onChanged()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }
  const cancelAll = async () => {
    try {
      await futuresApi.cancelAll(account)
      toast.success("Ordens canceladas")
      onChanged()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const tabs: [Tab, string][] = [
    ["positions", `Posições (${positions.length})`],
    ["orders", `Ordens em aberto (${openOrders.length})`],
    ["history", "Histórico de ordens"],
    ["fills", "Histórico de trades"],
    ["pnl", "P&L fechado"],
    ["funding", "Financiamento"],
  ]

  const authenticated = state?.authenticated

  return (
    <section aria-label="Conta" className="flex h-full flex-col bg-term-panel">
      <div className="flex items-center justify-between border-b border-term-line pr-3">
        <div role="tablist" className="flex gap-5 overflow-x-auto px-3">
          {tabs.map(([k, label]) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={cn(
                "shrink-0 border-b-2 py-2.5 text-sm font-medium",
                tab === k ? "border-primary text-term-text" : "border-transparent text-term-muted hover:text-term-text",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === "positions" && positions.length > 0 && (
          <button
            onClick={closeAll}
            disabled={closingAll}
            className="shrink-0 rounded bg-short/15 px-2 py-1 text-xs font-semibold text-short hover:bg-short/25 disabled:opacity-50"
          >
            {closingAll ? "Fechando..." : "Fechar tudo"}
          </button>
        )}
        {tab === "orders" && openOrders.length > 0 && (
          <button onClick={cancelAll} className="shrink-0 text-xs font-medium text-primary hover:underline">
            Cancelar todas
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {!authenticated ? (
          <Empty text={state && !state.configured ? "Banco de dados não configurado." : "Faça login para ver suas posições e ordens."} />
        ) : tab === "positions" ? (
          positions.length === 0 ? (
            <Empty text="Nenhuma posição aberta." />
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <Th>Contrato</Th>
                  <Th right>Qtd</Th>
                  <Th right>Valor (BRL)</Th>
                  <Th right>Preço entrada</Th>
                  <Th right>Preço marca</Th>
                  <Th right>Preço liq.</Th>
                  <Th right>Margem</Th>
                  <Th right>PnL não realizado (ROI)</Th>
                  <Th right>TP/SL</Th>
                  <Th right>Fechar posição</Th>
                </tr>
              </thead>
              <tbody>
                {positions.map((p) => (
                  <PositionRow key={p.id} p={p} mark={markOf(p.symbol)} onChanged={onChanged} onEditTpSl={() => setEditing(p)} onEditLeverage={() => setEditingLev(p)} />
                ))}
              </tbody>
            </table>
          )
        ) : tab === "orders" ? (
          openOrders.length === 0 ? <Empty text="Nenhuma ordem em aberto." /> : <OrdersTable orders={openOrders} onCancel={cancel} />
        ) : tab === "history" ? (
          (state?.orderHistory.length ?? 0) === 0 ? <Empty text="Sem histórico de ordens." /> : <OrdersTable orders={state!.orderHistory} />
        ) : tab === "fills" ? (
          (state?.fills.length ?? 0) === 0 ? (
            <Empty text="Sem trades executados." />
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <Th>Contrato</Th>
                  <Th>Lado</Th>
                  <Th right>Preço</Th>
                  <Th right>Qtd</Th>
                  <Th right>Taxa</Th>
                  <Th right>PnL realizado</Th>
                  <Th>Execução</Th>
                  <Th right>Hora</Th>
                </tr>
              </thead>
              <tbody>
                {state!.fills.map((f) => {
                  const m = MARKET_MAP[f.symbol]
                  return (
                    <tr key={f.id} className="border-t border-term-line/60 text-term-text hover:bg-term-line/30">
                      <Td className="font-sans font-semibold">{f.symbol}</Td>
                      <Td className="font-sans">
                        <SideLabel side={f.side} />
                      </Td>
                      <Td right>{formatPrice(f.price, m?.priceDecimals ?? 2)}</Td>
                      <Td right>{f.qty.toFixed(m?.qtyDecimals ?? 3)}</Td>
                      <Td right>{formatUsd(f.fee, 4)}</Td>
                      <Td right className={f.realized_pnl > 0 ? "text-long" : f.realized_pnl < 0 ? "text-short" : ""}>
                        {formatUsd(f.realized_pnl)}
                      </Td>
                      <Td className="font-sans text-term-muted">
                        {CLOSE_REASON[f.exec_type] ?? (f.exec_type === "open" ? "Abertura" : f.exec_type)} · {f.is_maker ? "Maker" : "Taker"}
                      </Td>
                      <Td right className="text-term-muted">{time(f.created_at)}</Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )
        ) : tab === "funding" ? (
          funding.length === 0 ? (
            <Empty text="Nenhuma cobrança de financiamento ainda. A cobrança ocorre a cada 8h nas posições abertas." />
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <Th>Contrato</Th>
                  <Th right>Taxa</Th>
                  <Th right>Preço marca</Th>
                  <Th right>Valor (BRL)</Th>
                  <Th right>Horário</Th>
                </tr>
              </thead>
              <tbody>
                {funding.map((f) => (
                  <tr key={f.id} className="border-t border-term-line/60 text-term-text hover:bg-term-line/30">
                    <Td className="font-sans font-semibold">{f.symbol}</Td>
                    <Td right>{(f.rate * 100).toFixed(4)}%</Td>
                    <Td right>{formatPrice(f.mark_price, MARKET_MAP[f.symbol]?.priceDecimals ?? 2)}</Td>
                    <Td right className={f.amount >= 0 ? "text-long" : "text-short"}>
                      {f.amount >= 0 ? "+" : ""}
                      {formatUsd(f.amount, 4)}
                    </Td>
                    <Td right className="text-term-muted">{time(f.funding_time)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : (state?.closedPositions.length ?? 0) === 0 ? (
          <Empty text="Nenhuma posição fechada." />
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr>
                <Th>Contrato</Th>
                <Th>Lado</Th>
                <Th right>Preço entrada</Th>
                <Th right>Preço saída</Th>
                <Th right>Taxas</Th>
                <Th right>PnL fechado</Th>
                <Th>Motivo</Th>
                <Th right>Fechada em</Th>
              </tr>
            </thead>
            <tbody>
              {state!.closedPositions.map((p) => {
                const d = MARKET_MAP[p.symbol]?.priceDecimals ?? 2
                return (
                  <tr key={p.id} className="border-t border-term-line/60 text-term-text hover:bg-term-line/30">
                    <Td className="font-sans font-semibold">{p.symbol}</Td>
                    <Td className="font-sans">
                      <SideLabel side={p.side} /> <span className="text-term-muted">{p.leverage}x</span>
                    </Td>
                    <Td right>{formatPrice(p.entry_price, d)}</Td>
                    <Td right>{formatPrice(p.exit_price, d)}</Td>
                    <Td right>{formatUsd(p.fees_paid, 4)}</Td>
                    <Td right className={p.realized_pnl >= 0 ? "text-long" : "text-short"}>
                      {p.realized_pnl >= 0 ? "+" : ""}
                      {formatUsd(p.realized_pnl)}
                    </Td>
                    <Td className="font-sans text-term-muted">
                      {p.status === "liquidated" ? "Liquidação" : (CLOSE_REASON[p.close_reason ?? ""] ?? "Manual")}
                    </Td>
                    <Td right className="text-term-muted">{p.closed_at ? time(p.closed_at) : "--"}</Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
      {editing && (
        <TpSlDialog
          position={editing}
          livePrice={markOf(editing.symbol)}
          onClose={() => setEditing(null)}
          onSaved={onChanged}
        />
      )}
      {editingLev && <LeverageDialog position={editingLev} onClose={() => setEditingLev(null)} onSaved={onChanged} />}
    </section>
  )
}
