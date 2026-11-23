"use client"

import { useState, type ReactNode } from "react"
import { toast } from "sonner"
import { Pencil, Share2 } from "lucide-react"
import { AssetIcon } from "./asset-icon"
import { PnlShareDialog, type PnlShareData } from "./pnl-share-dialog"
import { Slider } from "@/components/ui/slider"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import {
  MARKET_MAP,
  estimateClosePnl,
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

  // Resultado se a posição inteira fechar no preço digitado, a partir do preço de entrada.
  const estimateLine = (kind: "tp" | "sl", raw: string) => {
    if (!market || !raw) return null
    const target = parseDecimalInput(raw, livePrice ?? position.entry_price)
    if (!(Number.isFinite(target) && target > 0)) return null
    const { pnl, roi } = estimateClosePnl(market, position.side, position.qty, position.entry_price, target, position.leverage)
    const positive = pnl >= 0
    const sign = positive ? "+" : "−"
    return (
      <p className="-mt-1 flex justify-between px-1 text-[11px]">
        <span className="text-term-muted">{kind === "tp" ? "Lucro estimado" : "Perda estimada"}</span>
        <span className={cn("font-semibold tabular-nums", positive ? "text-long" : "text-short")}>
          {sign}
          {formatUsd(Math.abs(pnl))} USD · {sign}
          {Math.abs(roi).toFixed(2)}%
        </span>
      </p>
    )
  }

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
        {estimateLine("tp", tp)}
        {input("Stop Loss", sl, setSl)}
        {estimateLine("sl", sl)}
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

function CloseDialog({
  position,
  mark,
  onClose,
  onDone,
}: {
  position: Position
  mark: number | null
  onClose: () => void
  onDone: () => void
}) {
  const market = MARKET_MAP[position.symbol]
  const [mode, setMode] = useState<"market" | "limit">("market")
  const [price, setPrice] = useState(mark != null ? mark.toFixed(market?.priceDecimals ?? 2) : "")
  const [busy, setBusy] = useState(false)
  if (!market) return null
  const target = mode === "market" ? mark : parseDecimalInput(price, mark ?? position.entry_price)
  const est =
    target != null && Number.isFinite(target) && target > 0
      ? estimateClosePnl(market, position.side, position.qty, position.entry_price, target, position.leverage)
      : null

  const submit = async () => {
    const limit = mode === "limit" ? target : undefined
    if (mode === "limit" && !(limit != null && Number.isFinite(limit) && limit > 0)) {
      toast.error("Informe um preço válido")
      return
    }
    setBusy(true)
    try {
      await futuresApi.closePosition(position.id, undefined, limit ?? undefined)
      toast.success(limit ? "Ordem de fechamento enviada" : `Posição ${position.symbol} fechada`)
      onDone()
      onClose()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="border-term-line bg-term-panel text-term-text sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Fechar posição · {position.symbol}</DialogTitle>
          <DialogDescription className="text-term-muted">
            {position.side === "long" ? "Long" : "Short"} {position.leverage}x · {position.qty.toFixed(market.qtyDecimals)}{" "}
            {market.qtyUnit}
          </DialogDescription>
        </DialogHeader>
        <div role="tablist" aria-label="Tipo de fechamento" className="grid grid-cols-2 gap-1 rounded-md bg-term-bg p-1">
          {(
            [
              ["market", "A mercado"],
              ["limit", "Limitada"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={mode === k}
              onClick={() => setMode(k)}
              className={cn(
                "h-8 rounded text-sm font-semibold transition-colors",
                mode === k ? "bg-term-line text-term-text" : "text-term-muted hover:text-term-text",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {mode === "limit" && (
          <label className="flex items-center gap-2 rounded-md bg-term-bg px-3 py-2 focus-within:ring-1 focus-within:ring-primary">
            <span className="text-xs text-term-muted">Preço ({market.quote})</span>
            <input
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(sanitizeDecimalInput(e.target.value))}
              className="w-full bg-transparent text-right font-mono text-sm text-term-text outline-none"
            />
          </label>
        )}
        {est && (
          <p className="flex justify-between text-xs">
            <span className="text-term-muted">P&L estimado</span>
            <span className={cn("font-mono font-semibold", est.pnl >= 0 ? "text-long" : "text-short")}>
              {est.pnl >= 0 ? "+" : ""}
              {formatUsd(est.pnl)} USD ({est.roi >= 0 ? "+" : ""}
              {est.roi.toFixed(2)}%)
            </span>
          </p>
        )}
        <button
          onClick={submit}
          disabled={busy}
          className="rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {busy ? "Enviando..." : mode === "market" ? "Fechar a mercado" : "Enviar ordem limitada"}
        </button>
      </DialogContent>
    </Dialog>
  )
}

function Metric({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="truncate text-[11px] text-term-muted">{label}</dt>
      <dd className={cn("truncate font-mono text-[13px] font-medium text-term-text", className)}>{value}</dd>
    </div>
  )
}

const cardBtn =
  "flex h-8 min-w-0 items-center justify-center truncate rounded-md border border-term-line px-2 text-xs font-semibold text-term-text transition-colors hover:border-term-muted hover:bg-term-line/60 disabled:opacity-50"

function PositionCard({
  p,
  mark,
  onEditTpSl,
  onEditLeverage,
  onClosePosition,
  onShare,
}: {
  p: Position
  mark: number | null
  onEditTpSl: () => void
  onEditLeverage: () => void
  onClosePosition: () => void
  onShare: (roi: number) => void
}) {
  const market = MARKET_MAP[p.symbol]
  if (!market) return null
  const d = market.priceDecimals
  const pnl = mark != null ? unrealizedPnl(market, p.side, p.qty, p.entry_price, mark) : 0
  const roi = p.margin > 0 ? (pnl / p.margin) * 100 : 0
  const up = pnl >= 0

  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-lg border border-term-line/70 bg-term-bg/40 p-3">
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <AssetIcon market={market} size={28} />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-[15px] font-bold leading-tight text-term-text">{p.symbol}</span>
            <span className="flex items-center gap-1.5 text-xs">
              <span className={cn("font-semibold", p.side === "long" ? "text-long" : "text-short")}>
                {p.side === "long" ? "Long" : "Short"}
              </span>
              <button
                type="button"
                onClick={onEditLeverage}
                className="inline-flex items-center gap-1 whitespace-nowrap text-term-muted hover:text-term-text"
              >
                {p.margin_mode === "cross" ? "Cruzada" : "Isolada"} {p.leverage}x
                <Pencil className="size-3" aria-hidden="true" />
                <span className="sr-only">Ajustar alavancagem</span>
              </button>
            </span>
          </div>
        </div>
        <div className="flex min-w-0 items-start gap-2">
          <div className="flex min-w-0 flex-col items-end">
            <span className="truncate text-[11px] text-term-muted">P&L não realizado (USD)</span>
            <span className={cn("whitespace-nowrap font-mono text-base font-bold leading-tight sm:text-lg", up ? "text-long" : "text-short")}>
              {up ? "+" : ""}
              {formatUsd(pnl)} ({roi >= 0 ? "+" : ""}
              {roi.toFixed(2)}%)
            </span>
          </div>
          <button
            type="button"
            onClick={() => onShare(roi)}
            aria-label={`Compartilhar P&L de ${p.symbol}`}
            className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md text-term-muted hover:bg-term-line hover:text-term-text"
          >
            <Share2 className="size-4" aria-hidden="true" />
          </button>
        </div>
      </header>

      <dl className="grid grid-cols-4 gap-x-3 gap-y-2">
        <Metric label={`Quantidade (${market.qtyUnit})`} value={p.qty.toFixed(market.qtyDecimals)} />
        <Metric label="Preço de entrada" value={formatPrice(p.entry_price, d)} />
        <Metric label="Preço de marcação" value={formatPrice(mark, d)} />
        <Metric label="Preço liq. est." value={formatPrice(p.liquidation_price, d)} className="text-term-accent" />
        <Metric label="Valor (USD)" value={formatUsd(mark != null ? notionalUsd(market, p.qty, mark) : null)} />
        <Metric label="Margem (USD)" value={formatUsd(p.margin)} />
        <div className="col-span-2 flex min-w-0 flex-col gap-0.5">
          <dt className="text-[11px] text-term-muted">TP/SL</dt>
          <dd className="truncate font-mono text-[13px] font-medium">
            <span className={p.take_profit ? "text-long" : "text-term-muted"}>
              {p.take_profit ? formatPrice(p.take_profit, d) : "--"}
            </span>
            <span className="text-term-muted"> / </span>
            <span className={p.stop_loss ? "text-short" : "text-term-muted"}>{p.stop_loss ? formatPrice(p.stop_loss, d) : "--"}</span>
          </dd>
        </div>
      </dl>

      <div className="grid grid-cols-3 gap-2">
        <button type="button" onClick={onEditTpSl} className={cardBtn}>
          Definir TP/SL
        </button>
        <button type="button" onClick={onEditTpSl} className={cardBtn}>
          Trailing stop
        </button>
        <button type="button" onClick={onClosePosition} className={cardBtn}>
          Fechar
        </button>
      </div>
    </article>
  )
}

function OrderCard({ o, onCancel }: { o: Order; onCancel: (id: string) => void }) {
  const m = MARKET_MAP[o.symbol]
  const d = m?.priceDecimals ?? 2
  const buy = o.side === "buy"
  return (
    <article className="flex min-w-0 flex-col gap-3 rounded-lg border border-term-line/70 bg-term-bg/40 p-3">
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          {m && <AssetIcon market={m} size={28} />}
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-[15px] font-bold leading-tight text-term-text">{o.symbol}</span>
            <span className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className={cn("font-semibold", buy ? "text-long" : "text-short")}>{buy ? "Compra" : "Venda"}</span>
              <span className="text-term-muted">{ORDER_TYPE[o.order_type]}</span>
              {o.reduce_only && <span className="rounded bg-term-line px-1 text-[10px] text-term-text">Reduzir</span>}
            </span>
          </div>
        </div>
        <span className="whitespace-nowrap font-mono text-[11px] text-term-muted">{time(o.created_at)}</span>
      </header>
      <dl className="grid grid-cols-4 gap-x-3 gap-y-2">
        <Metric label="Preço" value={o.price ? formatPrice(o.price, d) : "Mercado"} />
        <Metric label={`Qtd (${m?.qtyUnit ?? ""})`} value={o.qty.toFixed(m?.qtyDecimals ?? 3)} />
        <Metric
          label="Disparo"
          value={o.trigger_price ? `${o.trigger_direction === "rise" ? "≥" : "≤"} ${formatPrice(o.trigger_price, d)}` : "--"}
        />
        <Metric label="Margem (USD)" value={formatUsd(o.reserved_margin)} />
        <div className="col-span-4 flex min-w-0 flex-col gap-0.5">
          <dt className="text-[11px] text-term-muted">TP/SL</dt>
          <dd className="truncate font-mono text-[13px] font-medium">
            <span className={o.take_profit ? "text-long" : "text-term-muted"}>{o.take_profit ? formatPrice(o.take_profit, d) : "--"}</span>
            <span className="text-term-muted"> / </span>
            <span className={o.stop_loss ? "text-short" : "text-term-muted"}>{o.stop_loss ? formatPrice(o.stop_loss, d) : "--"}</span>
          </dd>
        </div>
      </dl>
      <button type="button" onClick={() => onCancel(o.id)} className={cardBtn}>
        Cancelar ordem
      </button>
    </article>
  )
}

const cardGrid = "grid gap-3 p-3 xl:grid-cols-2 min-[1800px]:grid-cols-3 phone:grid-cols-1 phone:gap-2 phone:p-2"

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
  const [closing, setClosing] = useState<Position | null>(null)
  const [sharing, setSharing] = useState<PnlShareData | null>(null)
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
                "shrink-0 whitespace-nowrap border-b-2 py-2.5 text-sm transition-colors",
                tab === k
                  ? "border-term-accent font-bold text-term-text"
                  : "border-transparent font-medium text-term-muted hover:text-term-text",
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
            <div className={cardGrid}>
              {positions.map((p) => (
                <PositionCard
                  key={p.id}
                  p={p}
                  mark={markOf(p.symbol)}
                  onEditTpSl={() => setEditing(p)}
                  onEditLeverage={() => setEditingLev(p)}
                  onClosePosition={() => setClosing(p)}
                  onShare={(roi) => {
                    const m = MARKET_MAP[p.symbol]
                    setSharing({
                      symbol: p.symbol,
                      side: p.side,
                      leverage: p.leverage,
                      roi,
                      entry: p.entry_price,
                      current: markOf(p.symbol) ?? p.entry_price,
                      decimals: m?.priceDecimals ?? 2,
                      demo: account === "demo",
                    })
                  }}
                />
              ))}
            </div>
          )
        ) : tab === "orders" ? (
          openOrders.length === 0 ? (
            <Empty text="Nenhuma ordem em aberto." />
          ) : (
            <div className={cardGrid}>
              {openOrders.map((o) => (
                <OrderCard key={o.id} o={o} onCancel={cancel} />
              ))}
            </div>
          )
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
                  <Th right>Valor (USD)</Th>
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
                <Th right>
                  <span className="sr-only">Compartilhar</span>
                </Th>
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
                    <Td right className="font-sans">
                      <button
                        type="button"
                        aria-label={`Compartilhar P&L de ${p.symbol}`}
                        onClick={() =>
                          setSharing({
                            symbol: p.symbol,
                            side: p.side,
                            leverage: p.leverage,
                            roi: p.margin > 0 ? (p.realized_pnl / p.margin) * 100 : 0,
                            entry: p.entry_price,
                            current: p.exit_price ?? p.entry_price,
                            decimals: d,
                            demo: account === "demo",
                          })
                        }
                        className="inline-flex size-7 items-center justify-center rounded-md text-term-muted hover:bg-term-line hover:text-term-text"
                      >
                        <Share2 className="size-4" aria-hidden="true" />
                      </button>
                    </Td>
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
      {closing && (
        <CloseDialog position={closing} mark={markOf(closing.symbol)} onClose={() => setClosing(null)} onDone={onChanged} />
      )}
      {sharing && <PnlShareDialog data={sharing} onClose={() => setSharing(null)} />}
    </section>
  )
}
