"use client"

import { useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Slider } from "@/components/ui/slider"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import {
  MAKER_FEE,
  TAKER_FEE,
  estimateClosePnl,
  formatPrice,
  formatUsd,
  liquidationPrice,
  parseDecimalInput,
  quoteToUsd,
  roundToStep,
  sanitizeDecimalInput,
  tpSlError,
  type FuturesMarket,
} from "@/lib/futures/markets"
import type { AccountMode, MarginMode, OrderSide, OrderType, TimeInForce } from "@/lib/futures/types"
import { futuresApi, type ClientTradingPrefs } from "@/hooks/use-futures"
import { TpSlAdvancedDialog } from "@/components/futures/tpsl-advanced-dialog"

interface OrderPanelProps {
  market: FuturesMarket
  account: AccountMode
  balance: number
  authenticated: boolean
  configured: boolean
  lastPrice: number | null
  price: string
  onPriceChange: (v: string) => void
  onSubmitted: () => void
}

function Field({
  label,
  unit,
  value,
  onChange,
  disabled,
  placeholder,
}: {
  label: string
  unit: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  placeholder?: string
}) {
  return (
    <label
      className={cn(
        "flex items-center gap-3 rounded-lg border border-term-line bg-term-bg px-3 py-2 transition-colors focus-within:border-primary hover:border-term-muted/50",
        disabled && "opacity-60",
      )}
    >
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[11px] leading-4 text-term-muted">{label}</span>
        <input
          inputMode="decimal"
          value={value}
          disabled={disabled}
          placeholder={placeholder ?? "0"}
          onChange={(e) => onChange(sanitizeDecimalInput(e.target.value))}
          className="w-full min-w-0 bg-transparent text-[15px] font-semibold tabular-nums leading-6 text-term-text outline-none placeholder:font-normal placeholder:text-term-muted/70"
        />
      </span>
      <span className="shrink-0 text-sm font-semibold text-term-text">{unit}</span>
    </label>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <dt className="text-term-muted underline decoration-term-muted/40 decoration-dotted underline-offset-4">{label}</dt>
      <dd className="text-right font-medium tabular-nums text-term-text">{children}</dd>
    </div>
  )
}

function PnlHint({ kind, side, pnl, roi }: { kind: "tp" | "sl"; side: "long" | "short"; pnl: number; roi: number }) {
  const positive = pnl >= 0
  const sign = positive ? "+" : "−"
  return (
    <p className="flex items-center justify-between gap-2 px-1 text-[11px] leading-relaxed">
      <span className="text-term-muted">
        {kind === "tp" ? "Lucro estimado" : "Perda estimada"} ({side === "long" ? "Long" : "Short"})
      </span>
      <span className={cn("font-semibold tabular-nums", positive ? "text-long" : "text-short")}>
        {sign}
        {formatUsd(Math.abs(pnl))} BRL · {sign}
        {Math.abs(roi).toFixed(2)}%
      </span>
    </p>
  )
}

const LEVERAGE_MARKS = (max: number) => [1, ...[0.1, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f))]
const PERCENT_MARKS = [0, 25, 50, 75, 100]

function riskLevel(lev: number) {
  if (lev <= 10) return { label: "Risco baixo", className: "text-long" }
  if (lev <= 25) return { label: "Risco moderado", className: "text-primary" }
  if (lev <= 50) return { label: "Risco alto", className: "text-short" }
  return { label: "Risco extremo", className: "text-short" }
}

function LeverageDialog({
  open,
  onOpenChange,
  max,
  value,
  mode,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  max: number
  value: number
  mode: MarginMode
  onConfirm: (v: number, mode: MarginMode) => void
}) {
  const [draft, setDraft] = useState(value)
  const [draftMode, setDraftMode] = useState<MarginMode>(mode)
  const risk = riskLevel(draft)
  const liqMove = (100 / draft) * (1 - draft * 0.005)
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) {
          setDraft(value)
          setDraftMode(mode)
        }
        onOpenChange(o)
      }}
    >
      <DialogContent className="border-term-line bg-term-panel text-term-text sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Alavancagem e modo de margem</DialogTitle>
          <DialogDescription className="text-term-muted">
            Vale para as próximas ordens deste contrato.
          </DialogDescription>
        </DialogHeader>
        <div role="radiogroup" aria-label="Modo de margem" className="grid grid-cols-2 gap-2">
          {(
            [
              ["cross", "Cruzada"],
              ["isolated", "Isolada"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              role="radio"
              aria-checked={draftMode === k}
              onClick={() => setDraftMode(k)}
              className={cn(
                "rounded-lg border py-2 text-sm font-semibold",
                draftMode === k ? "border-primary bg-primary/10 text-primary" : "border-term-line text-term-muted hover:text-term-text",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-[11px] leading-relaxed text-term-muted">
          {draftMode === "cross"
            ? "Cruzada: todo o saldo disponível sustenta suas posições. Reduz a chance de liquidação, mas uma perda grande pode consumir o saldo inteiro."
            : "Isolada: só a margem da posição fica em risco. A liquidação acontece antes, mas a perda máxima fica limitada a essa margem."}
        </p>
        <div className="flex items-center justify-between rounded-lg bg-term-bg px-3 py-2">
          <button
            className="px-2 text-lg text-term-muted hover:text-term-text"
            onClick={() => setDraft((d) => Math.max(1, d - 1))}
            aria-label="Diminuir"
          >
            −
          </button>
          <span className="text-xl font-bold tabular-nums">{draft}x</span>
          <button
            className="px-2 text-lg text-term-muted hover:text-term-text"
            onClick={() => setDraft((d) => Math.min(max, d + 1))}
            aria-label="Aumentar"
          >
            +
          </button>
        </div>
        <Slider min={1} max={max} step={1} value={[draft]} onValueChange={([v]) => setDraft(v)} />
        <div className="flex justify-between text-[11px] text-term-muted">
          {LEVERAGE_MARKS(max).map((m) => (
            <button key={m} onClick={() => setDraft(m)} className="hover:text-term-text">
              {m}x
            </button>
          ))}
        </div>
        <div className="rounded-lg bg-term-bg p-3 text-xs leading-relaxed">
          <p className={cn("font-semibold", risk.className)}>{risk.label}</p>
          <p className="text-term-muted">
            Com {draft}x, uma variação de cerca de {liqMove.toFixed(2)}% contra a posição pode causar liquidação
            {draftMode === "isolated" ? " da margem isolada." : "."}
          </p>
        </div>
        <button
          onClick={() => {
            onConfirm(draft, draftMode)
            onOpenChange(false)
          }}
          className="rounded-full bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
        >
          Confirmar
        </button>
      </DialogContent>
    </Dialog>
  )
}

export function OrderPanel({
  market,
  account,
  balance,
  authenticated,
  configured,
  lastPrice,
  price,
  onPriceChange,
  onSubmitted,
  prefs,
}: OrderPanelProps & { prefs?: ClientTradingPrefs | null }) {
  const [orderType, setOrderType] = useState<OrderType>("limit")
  const [marginMode, setMarginMode] = useState<MarginMode>(prefs?.defaultMarginMode ?? "cross")
  const [leverage, setLeverage] = useState(Math.min(prefs?.defaultLeverage ?? 10, market.maxLeverage))
  const [leverageOpen, setLeverageOpen] = useState(false)
  const [qty, setQty] = useState("")
  const [qtyMode, setQtyMode] = useState<"base" | "usdt">("base")
  const [percent, setPercent] = useState(0)
  const [triggerPrice, setTriggerPrice] = useState("")
  const [tpslEnabled, setTpslEnabled] = useState(false)
  const [tp, setTp] = useState("")
  const [sl, setSl] = useState("")
  const [tpslSide, setTpslSide] = useState<"long" | "short" | null>(null)
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [reduceOnly, setReduceOnly] = useState(false)
  const [postOnly, setPostOnly] = useState(false)
  const [tif, setTif] = useState<TimeInForce>("GTC")
  const [submitting, setSubmitting] = useState<OrderSide | null>(null)

  const toPrice = (v: string) => {
    const n = parseDecimalInput(v, lastPrice)
    return Number.isFinite(n) && n > 0 ? n : 0
  }
  const priceNum = toPrice(price)
  const triggerNum = toPrice(triggerPrice)
  const tpNum = tpslEnabled && tp ? toPrice(tp) : 0
  const slNum = tpslEnabled && sl ? toPrice(sl) : 0

  const execPrice =
    orderType === "market"
      ? (lastPrice ?? 0)
      : orderType === "conditional"
        ? priceNum || triggerNum || (lastPrice ?? 0)
        : priceNum || (lastPrice ?? 0)
  const tpSlRef =
    orderType === "market" ? execPrice : orderType === "conditional" ? triggerNum || execPrice : priceNum || execPrice

  const unitUsd = execPrice > 0 ? execPrice * market.contractSize * quoteToUsd(market, execPrice) : 0
  const feeRate = orderType === "limit" && postOnly ? MAKER_FEE : TAKER_FEE
  const maxQty = unitUsd > 0 ? roundToStep(balance / (unitUsd * (1 / leverage + feeRate)), market.qtyStep) : 0
  const rawQty = parseDecimalInput(qty) || 0
  const qtyNum =
    qtyMode === "usdt" ? (unitUsd > 0 ? roundToStep(rawQty / unitUsd, market.qtyStep) : 0) : rawQty
  const notional = qtyNum * unitUsd
  // Custo inclui margem inicial, taxa de abertura e taxa de fechamento estimada no preço de falência.
  const openCost = notional / leverage + notional * feeRate
  const costLong = openCost + notional * (1 - 1 / leverage) * TAKER_FEE
  const costShort = openCost + notional * (1 + 1 / leverage) * TAKER_FEE
  const hasQty = qtyNum > 0

  // TP acima da referência (ou SL abaixo) indica Long; o contrário indica Short.
  const inferredSide: "long" | "short" | null =
    tpSlRef > 0 && tpNum > 0
      ? tpNum > tpSlRef
        ? "long"
        : "short"
      : tpSlRef > 0 && slNum > 0
        ? slNum < tpSlRef
          ? "long"
          : "short"
        : null
  const tpSlSide = tpNum > 0 || slNum > 0 ? (tpslSide ?? inferredSide) : null
  const tpEstimate =
    tpSlSide && hasQty && tpNum > 0 ? estimateClosePnl(market, tpSlSide, qtyNum, tpSlRef, tpNum, leverage, feeRate) : null
  const slEstimate =
    tpSlSide && hasQty && slNum > 0 ? estimateClosePnl(market, tpSlSide, qtyNum, tpSlRef, slNum, leverage, feeRate) : null

  const applyPercent = (p: number) => {
    setPercent(p)
    const q = roundToStep((maxQty * p) / 100, market.qtyStep)
    if (q <= 0) return setQty("")
    setQty(qtyMode === "usdt" ? (q * unitUsd).toFixed(2) : q.toFixed(market.qtyDecimals))
  }

  const switchQtyMode = () => {
    const next = qtyMode === "base" ? "usdt" : "base"
    if (qtyNum > 0) setQty(next === "usdt" ? notional.toFixed(2) : qtyNum.toFixed(market.qtyDecimals))
    setQtyMode(next)
  }

  const submit = async (side: OrderSide) => {
    if (!authenticated) return
    if (qtyNum < market.minQty) {
      toast.error(`Quantidade mínima: ${market.minQty} ${market.qtyUnit}`)
      return
    }
    if ((tpslEnabled && tp && !tpNum) || (tpslEnabled && sl && !slNum)) {
      toast.error("Informe um valor válido para o Take Profit / Stop Loss")
      return
    }
    const tpSlMessage =
      tpSlRef > 0 ? tpSlError(side, tpSlRef, tpNum || null, slNum || null, market.priceDecimals) : null
    if (tpSlMessage) {
      toast.error(tpSlMessage)
      return
    }
    if (
      prefs?.confirmOrders &&
      !window.confirm(
        `Confirmar ${side === "buy" ? "LONG" : "SHORT"} ${qtyNum} ${market.qtyUnit} de ${market.symbol} a ${
          orderType === "market" ? "mercado" : price || triggerPrice
        } com ${leverage}x?`,
      )
    ) {
      return
    }
    setSubmitting(side)
    try {
      await futuresApi.placeOrder({
        account,
        symbol: market.symbol,
        side,
        orderType,
        qty: qtyNum,
        price: orderType === "market" ? null : priceNum || null,
        triggerPrice: orderType === "conditional" ? triggerNum || null : null,
        leverage,
        marginMode,
        reduceOnly,
        postOnly: orderType === "limit" && postOnly,
        timeInForce: orderType === "limit" && postOnly ? "PostOnly" : tif,
        takeProfit: tpNum || null,
        stopLoss: slNum || null,
      })
      toast.success(
        orderType === "market"
          ? `${side === "buy" ? "Long" : "Short"} executado em ${market.symbol}`
          : "Ordem enviada com sucesso",
      )
      setQty("")
      setPercent(0)
      setTp("")
      setSl("")
      setTpslSide(null)
      onSubmitted()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSubmitting(null)
    }
  }

  const liqLong = hasQty && execPrice > 0 ? liquidationPrice("long", execPrice, leverage) : null
  const liqShort = hasQty && execPrice > 0 ? liquidationPrice("short", execPrice, leverage) : null

  const noBalance = authenticated && balance <= 0
  const canCheck = authenticated && !noBalance && !reduceOnly && hasQty
  const insufficientLong = canCheck && costLong > balance
  const insufficientShort = canCheck && costShort > balance
  const blockedLong = submitting !== null || noBalance || insufficientLong
  const blockedShort = submitting !== null || noBalance || insufficientShort
  const blockedReason = noBalance
    ? account === "real"
      ? "Saldo zerado. Deposite para abrir posições."
      : "Saldo demo zerado."
    : insufficientLong || insufficientShort
      ? `Saldo insuficiente: custo ${formatUsd(insufficientLong ? costLong : costShort)} BRL, disponível ${formatUsd(balance)} BRL.`
      : null

  return (
    <section aria-label="Enviar ordem" className="flex h-full flex-col gap-3 overflow-y-auto bg-term-panel p-3 font-sans">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-term-text">Trade</h2>
        <span className="rounded-full bg-term-bg px-2 py-0.5 text-[11px] font-medium text-term-muted">
          {account === "demo" ? "Conta demo" : "Conta real"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setLeverageOpen(true)}
          className="rounded-lg border border-term-line bg-term-bg py-2 text-xs font-semibold text-term-text hover:border-term-muted/50"
        >
          {marginMode === "cross" ? "Cruzada" : "Isolada"}
        </button>
        <button
          onClick={() => setLeverageOpen(true)}
          className="rounded-lg border border-term-line bg-term-bg py-2 text-xs font-semibold tabular-nums text-term-text hover:border-term-muted/50"
        >
          {leverage}.00x
        </button>
      </div>
      <LeverageDialog
        open={leverageOpen}
        onOpenChange={setLeverageOpen}
        max={market.maxLeverage}
        value={leverage}
        mode={marginMode}
        onConfirm={(lev, mode) => {
          setLeverage(lev)
          setMarginMode(mode)
        }}
      />

      <div role="tablist" aria-label="Tipo de ordem" className="flex gap-5 phone:gap-4">
        {(
          [
            ["limit", "Limite"],
            ["market", "Mercado"],
            ["conditional", "Condicional"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            role="tab"
            aria-selected={orderType === k}
            onClick={() => setOrderType(k)}
            className={cn(
              "text-[15px] font-bold transition-colors phone:text-sm",
              orderType === k ? "text-primary" : "text-term-muted hover:text-term-text",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-term-muted underline decoration-term-muted/40 decoration-dotted underline-offset-4">
          Saldo disponível
        </span>
        <span className="flex items-center gap-1.5 font-semibold tabular-nums text-term-text">
          {authenticated ? formatUsd(balance) : "--"} BRL
          {authenticated && account === "real" && (
            <Link
              href="/deposit"
              aria-label="Depositar"
              className="flex size-4 items-center justify-center rounded-full bg-primary text-[11px] font-bold leading-none text-primary-foreground hover:opacity-90"
            >
              +
            </Link>
          )}
        </span>
      </div>

      {orderType === "conditional" && (
        <Field
          label="Preço de disparo"
          unit={market.quote}
          value={triggerPrice}
          onChange={setTriggerPrice}
          placeholder={formatPrice(lastPrice, market.priceDecimals).replace(/,/g, "")}
        />
      )}
      {orderType === "market" ? (
        <div className="flex items-center gap-3 rounded-lg border border-term-line bg-term-bg px-3 py-2">
          <span className="flex flex-1 flex-col">
            <span className="text-[11px] leading-4 text-term-muted">Preço</span>
            <span className="text-[15px] font-semibold leading-6 text-term-muted">Melhor preço de mercado</span>
          </span>
          <span className="text-sm font-semibold text-term-text">{market.quote}</span>
        </div>
      ) : (
        <div className="flex gap-2">
          <div className="flex-1">
            <Field
              label="Preço"
              unit={market.quote}
              value={price}
              onChange={onPriceChange}
              placeholder={orderType === "conditional" ? "A mercado" : undefined}
            />
          </div>
          <button
            onClick={() => lastPrice && onPriceChange(lastPrice.toFixed(market.priceDecimals))}
            className="rounded-lg border border-term-line bg-term-bg px-3 text-xs font-semibold text-term-text hover:border-term-muted/50"
          >
            Último
          </button>
        </div>
      )}

      <div className="flex gap-2">
        <div className="flex-1">
          <Field
            label={qtyMode === "usdt" ? "Valor do pedido" : "Quantidade"}
            unit={qtyMode === "usdt" ? "USDT" : market.qtyUnit}
            value={qty}
            onChange={(v) => {
              setQty(v)
              setPercent(0)
            }}
          />
        </div>
        <button
          onClick={switchQtyMode}
          aria-label={`Inserir quantidade em ${qtyMode === "base" ? "USDT" : market.qtyUnit}`}
          className="rounded-lg border border-term-line bg-term-bg px-3 text-xs font-semibold text-term-text hover:border-term-muted/50"
        >
          {qtyMode === "base" ? "USDT" : market.qtyUnit}
        </button>
      </div>
      {qtyMode === "usdt" && hasQty && (
        <p className="-mt-1.5 text-right text-[11px] tabular-nums text-term-muted">
          {"≈ "}
          {qtyNum.toFixed(market.qtyDecimals)} {market.qtyUnit}
        </p>
      )}

      <div className="px-1.5 pt-1">
        <div className="relative">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-1/2 h-0">
            {PERCENT_MARKS.map((p) => (
              <span
                key={p}
                style={{ left: `${p}%` }}
                className={cn(
                  "absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2",
                  p <= percent ? "border-primary bg-primary" : "border-term-muted/60 bg-term-panel",
                )}
              />
            ))}
          </div>
          <Slider
            min={0}
            max={100}
            step={1}
            value={[percent]}
            onValueChange={([v]) => applyPercent(v)}
            aria-label="Percentual do saldo"
          />
        </div>
        <div className="mt-2 flex justify-between text-[11px] tabular-nums text-term-muted">
          {PERCENT_MARKS.map((p) => (
            <button
              key={p}
              onClick={() => applyPercent(p)}
              className={cn("hover:text-term-text", p === percent && "font-semibold text-term-text")}
            >
              {p}%
            </button>
          ))}
        </div>
      </div>

      <dl className="flex flex-col gap-1.5 rounded-lg border border-term-line px-3 py-2.5">
        <Row label="Valor do pedido">{formatUsd(notional)} BRL</Row>
        <Row label="Custo Long">
          <span className="text-long">{formatUsd(costLong)} BRL</span>
        </Row>
        <Row label="Custo Short">
          <span className="text-short">{formatUsd(costShort)} BRL</span>
        </Row>
        <Row label="Valor máximo">
          {authenticated ? maxQty.toFixed(market.qtyDecimals) : "--"} {market.qtyUnit}
        </Row>
      </dl>

      <div className="flex flex-col gap-2.5 text-xs font-medium text-term-text">
        <div className="flex items-center justify-between gap-2">
          <label className="flex items-center gap-2">
            <Checkbox className="border-term-muted" checked={tpslEnabled} onCheckedChange={(v) => setTpslEnabled(v === true)} />
            TP/SL
          </label>
          {tpslEnabled && (
            <button
              type="button"
              onClick={() => setAdvancedOpen(true)}
              disabled={!(tpSlRef > 0)}
              className="text-xs font-semibold text-primary hover:opacity-80 disabled:opacity-40"
            >
              Avançado
            </button>
          )}
        </div>
        {tpslEnabled && (
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => setAdvancedOpen(true)}
              disabled={!(tpSlRef > 0)}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 py-2.5 text-xs font-semibold text-primary hover:bg-primary/15 disabled:opacity-40"
            >
              <span aria-hidden className="flex size-4 items-center justify-center rounded-full border border-current text-[11px] leading-none">
                +
              </span>
              TP/SL Avançado
            </button>
            <Field
              label="Take Profit"
              unit={market.quote}
              value={tp}
              onChange={(v) => {
                setTp(v)
                setTpslSide(null)
              }}
            />
            {tpEstimate && tpSlSide && <PnlHint kind="tp" side={tpSlSide} {...tpEstimate} />}
            <Field
              label="Stop Loss"
              unit={market.quote}
              value={sl}
              onChange={(v) => {
                setSl(v)
                setTpslSide(null)
              }}
            />
            {slEstimate && tpSlSide && <PnlHint kind="sl" side={tpSlSide} {...slEstimate} />}
            {!hasQty && (tpNum > 0 || slNum > 0) && (
              <p className="px-1 text-[11px] text-term-muted">Informe a quantidade para ver o lucro e a perda estimados.</p>
            )}
          </div>
        )}
        <TpSlAdvancedDialog
          open={advancedOpen}
          onOpenChange={setAdvancedOpen}
          market={market}
          refPrice={tpSlRef}
          refLabel={orderType === "market" ? "Preço de mercado" : orderType === "conditional" ? "Preço de disparo" : "Preço da ordem"}
          lastPrice={lastPrice}
          qty={qtyNum}
          leverage={leverage}
          feeRate={feeRate}
          initialSide={tpSlSide ?? "long"}
          initialTp={tp}
          initialSl={sl}
          onConfirm={({ side, tp: nextTp, sl: nextSl }) => {
            setTp(nextTp)
            setSl(nextSl)
            setTpslSide(side)
          }}
        />
        <div className="flex items-center justify-between gap-2">
          <label className="flex items-center gap-2">
            <Checkbox className="border-term-muted" checked={reduceOnly} onCheckedChange={(v) => setReduceOnly(v === true)} />
            Somente reduzir
          </label>
          {orderType === "limit" && (
            <label className="flex items-center gap-2">
              <Checkbox className="border-term-muted" checked={postOnly} onCheckedChange={(v) => setPostOnly(v === true)} />
              Post-Only
            </label>
          )}
        </div>
        {orderType === "limit" && !postOnly && (
          <label className="flex items-center justify-between">
            <span className="text-term-muted">Validade</span>
            <select
              value={tif}
              onChange={(e) => setTif(e.target.value as TimeInForce)}
              className="rounded-lg border border-term-line bg-term-bg px-2 py-1 text-term-text outline-none"
            >
              <option value="GTC">Good-Till-Canceled</option>
              <option value="IOC">Immediate-Or-Cancel</option>
              <option value="FOK">Fill-Or-Kill</option>
            </select>
          </label>
        )}
      </div>

      {!configured ? (
        <p className="rounded-lg bg-short/10 p-3 text-xs leading-relaxed text-short">
          Banco de dados não configurado. Configure o Supabase nas variáveis do projeto para operar.
        </p>
      ) : authenticated ? (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => submit("buy")}
              disabled={blockedLong}
              aria-describedby={blockedReason ? "order-blocked-reason" : undefined}
              className="rounded-full bg-long py-3 text-sm font-bold text-term-text hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:opacity-40"
            >
              {submitting === "buy" ? "Enviando..." : "Comprar / Long"}
            </button>
            <button
              onClick={() => submit("sell")}
              disabled={blockedShort}
              aria-describedby={blockedReason ? "order-blocked-reason" : undefined}
              className="rounded-full bg-short py-3 text-sm font-bold text-term-text hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:opacity-40"
            >
              {submitting === "sell" ? "Enviando..." : "Vender / Short"}
            </button>
          </div>
          {blockedReason && (
            <p id="order-blocked-reason" role="status" className="text-[11px] leading-relaxed text-term-muted">
              {blockedReason}
            </p>
          )}
          {noBalance && account === "real" && (
            <Link
              href="/deposit"
              className="rounded-full bg-primary py-2.5 text-center text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Depositar
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Link
            href="/auth/sign-up"
            className="rounded-full bg-primary py-2.5 text-center text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Cadastrar
          </Link>
          <Link
            href="/auth/login"
            className="rounded-full bg-term-line py-2.5 text-center text-sm font-semibold text-term-text hover:opacity-90"
          >
            Entrar
          </Link>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        <dt className="text-term-muted">Liq. Long</dt>
        <dt className="text-right text-term-muted">Liq. Short</dt>
        <dd className="font-medium tabular-nums text-term-text">{formatPrice(liqLong, market.priceDecimals)}</dd>
        <dd className="text-right font-medium tabular-nums text-term-text">{formatPrice(liqShort, market.priceDecimals)}</dd>
      </dl>

      <p className="mt-auto text-[11px] leading-relaxed text-term-muted">
        Taxas: maker {(MAKER_FEE * 100).toFixed(3)}% · taker {(TAKER_FEE * 100).toFixed(3)}%
      </p>
    </section>
  )
}
