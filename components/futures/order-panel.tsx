"use client"

import { useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { ArrowLeftRight, ChevronRight, CirclePlus, Headset, Percent } from "lucide-react"
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
import { HintPopover } from "@/components/futures/hint-popover"
import { MenuSelect } from "@/components/futures/menu-select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CircleHelp } from "lucide-react"

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
  suffix,
}: {
  label: string
  unit: React.ReactNode
  value: string
  onChange: (v: string) => void
  disabled?: boolean
  placeholder?: string
  suffix?: React.ReactNode
}) {
  const [focused, setFocused] = useState(false)
  const floating = focused || value !== ""
  return (
    <div
      className={cn(
        "flex min-h-14 items-center gap-3 rounded-md border border-transparent bg-term-field px-3 transition-colors focus-within:border-term-accent",
        disabled && "opacity-60",
      )}
    >
      <label className="flex min-w-0 flex-1 flex-col justify-center">
        <span
          className={cn(
            "text-term-muted transition-all",
            floating ? "text-[11px] leading-4" : "text-sm leading-5",
          )}
        >
          {label}
        </span>
        <input
          inputMode="decimal"
          value={value}
          disabled={disabled}
          placeholder={floating ? (placeholder ?? "0") : ""}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => onChange(sanitizeDecimalInput(e.target.value))}
          className={cn(
            "w-full min-w-0 bg-transparent text-[15px] font-semibold tabular-nums text-term-text outline-none placeholder:font-normal placeholder:text-term-muted/60",
            floating ? "h-6" : "h-0",
          )}
        />
      </label>
      {suffix}
      <span className="shrink-0 text-sm font-semibold text-term-text">{unit}</span>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-[13px] leading-5">
      <dt className="text-term-muted">{label}</dt>
      <dd className="text-right font-semibold tabular-nums text-term-text">{children}</dd>
    </div>
  )
}

const ACCENT_CHECKBOX =
  "size-4 rounded-[3px] border-term-muted data-[state=checked]:border-term-accent data-[state=checked]:bg-term-accent data-[state=checked]:text-term-bg"
const ACCENT_SLIDER =
  "[&_[data-slot=slider-range]]:bg-term-accent [&_[data-slot=slider-thumb]]:size-4 [&_[data-slot=slider-thumb]]:border-[3px] [&_[data-slot=slider-thumb]]:border-term-accent [&_[data-slot=slider-thumb]]:bg-term-panel [&_[data-slot=slider-track]]:bg-term-line"

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
        {formatUsd(Math.abs(pnl))} USD · {sign}
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
  const [side, setSide] = useState<OrderSide>("buy")
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
  const [tpslMode, setTpslMode] = useState<"advanced" | "basic">("advanced")
  const [reduceOnly, setReduceOnly] = useState(false)
  const [postOnly, setPostOnly] = useState(false)
  const [tif, setTif] = useState<TimeInForce>("GTC")
  const [condExec, setCondExec] = useState<"limit" | "market">("limit")
  const [slippageOn, setSlippageOn] = useState(false)
  const [slippage, setSlippage] = useState("0.5")
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
        ? (condExec === "limit" ? priceNum : 0) || triggerNum || (lastPrice ?? 0)
        : priceNum || (lastPrice ?? 0)
  const slippagePct = parseDecimalInput(slippage) || 0
  const useSlippage = orderType === "market" && slippageOn && slippagePct > 0 && (lastPrice ?? 0) > 0
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

  const baseFieldValue = qtyMode === "base" ? qty : qtyNum > 0 ? qtyNum.toFixed(market.qtyDecimals) : ""
  const valueFieldValue = qtyMode === "usdt" ? qty : notional > 0 ? notional.toFixed(2) : ""

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
    if (orderType === "conditional" && !triggerNum) {
      toast.error("Informe o preço de acionamento")
      return
    }
    if (orderType === "conditional" && condExec === "limit" && !priceNum) {
      toast.error("Informe o preço da ordem limitada")
      return
    }
    const slippageLimit = useSlippage
      ? Number(((lastPrice as number) * (1 + ((side === "buy" ? 1 : -1) * slippagePct) / 100)).toFixed(market.priceDecimals))
      : null
    setSubmitting(side)
    try {
      await futuresApi.placeOrder({
        account,
        symbol: market.symbol,
        side,
        orderType: slippageLimit ? "limit" : orderType,
        qty: qtyNum,
        price:
          slippageLimit ??
          (orderType === "market" || (orderType === "conditional" && condExec === "market") ? null : priceNum || null),
        triggerPrice: orderType === "conditional" ? triggerNum || null : null,
        leverage,
        marginMode,
        reduceOnly,
        postOnly: orderType === "limit" && postOnly,
        timeInForce: slippageLimit ? "IOC" : orderType === "limit" && postOnly ? "PostOnly" : orderType === "limit" ? tif : "GTC",
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
      ? `Saldo insuficiente: custo ${formatUsd(insufficientLong ? costLong : costShort)} USD, disponível ${formatUsd(balance)} USD.`
      : null

  const isBuy = side === "buy"
  const blocked = isBuy ? blockedLong : blockedShort
  const sideReason = noBalance
    ? blockedReason
    : (isBuy ? insufficientLong : insufficientShort)
      ? `Saldo insuficiente: custo ${formatUsd(isBuy ? costLong : costShort)} USD, disponível ${formatUsd(balance)} USD.`
      : null
  const liq = isBuy ? liqLong : liqShort

  return (
    <section aria-label="Enviar ordem" className="flex h-full flex-col bg-term-panel font-sans">
      <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto p-3 [&>*]:shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-term-text">Trade</h2>
          <span className="rounded-sm bg-term-field px-2 py-0.5 text-[11px] font-medium text-term-muted">
            {account === "demo" ? "Conta demo" : "Conta real"}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setLeverageOpen(true)}
            className="flex-1 rounded-md bg-term-field py-1.5 text-xs font-semibold text-term-text hover:bg-term-line"
          >
            {marginMode === "cross" ? "Cruzada" : "Isolada"}
          </button>
          <button
            onClick={() => setLeverageOpen(true)}
            className="flex-1 rounded-md bg-term-field py-1.5 text-xs font-semibold tabular-nums text-term-text hover:bg-term-line"
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

        <div role="radiogroup" aria-label="Direção" className="grid grid-cols-2 overflow-hidden rounded-md bg-term-field">
          <button
            role="radio"
            aria-checked={isBuy}
            onClick={() => setSide("buy")}
            className={cn(
              "py-2 text-[15px] font-bold transition-colors",
              isBuy ? "rounded-md bg-long text-term-text" : "text-term-muted hover:text-term-text",
            )}
          >
            Comprar
          </button>
          <button
            role="radio"
            aria-checked={!isBuy}
            onClick={() => setSide("sell")}
            className={cn(
              "py-2 text-[15px] font-bold transition-colors",
              !isBuy ? "rounded-md bg-short text-term-text" : "text-term-muted hover:text-term-text",
            )}
          >
            Vender
          </button>
        </div>

        <div role="tablist" aria-label="Tipo de ordem" className="flex items-center gap-5">
          {(
            [
              ["limit", "Limitada"],
              ["market", "A mercado"],
              ["conditional", "TP/SL"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              role="tab"
              aria-selected={orderType === k}
              onClick={() => setOrderType(k)}
              className={cn(
                "text-[15px] font-semibold transition-colors",
                orderType === k ? "text-term-accent" : "text-term-muted hover:text-term-text",
              )}
            >
              {label}
            </button>
          ))}
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                aria-label="Sobre os tipos de ordem"
                className="ml-auto text-term-muted hover:text-term-text"
              >
                <CircleHelp className="size-4" aria-hidden />
              </button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-72 border-term-line bg-term-field p-3 text-xs leading-relaxed text-term-text"
            >
              <dl className="flex flex-col gap-2">
                <div>
                  <dt className="font-semibold">Limitada</dt>
                  <dd className="text-term-muted">Executa no preço definido por você ou melhor.</dd>
                </div>
                <div>
                  <dt className="font-semibold">A mercado</dt>
                  <dd className="text-term-muted">Executa na hora pelo melhor preço disponível.</dd>
                </div>
                <div>
                  <dt className="font-semibold">TP/SL</dt>
                  <dd className="text-term-muted">
                    Fica aguardando até o preço de acionamento ser atingido e então envia a ordem limitada ou a
                    mercado.
                  </dd>
                </div>
              </dl>
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex items-center justify-between gap-2 text-[13px]">
          <span className="text-term-text underline decoration-term-muted/60 decoration-dashed underline-offset-4">
            Saldo disponível
          </span>
          <span className="flex items-center gap-1.5 font-semibold tabular-nums text-term-text">
            {authenticated ? formatUsd(balance) : "--"} USD
            {authenticated && account === "real" && (
              <Link
                href="/deposit"
                aria-label="Depositar"
                className="flex size-4 items-center justify-center rounded-full border-2 border-term-accent text-[11px] font-bold leading-none text-term-accent hover:opacity-80"
              >
                +
              </Link>
            )}
          </span>
        </div>

        {orderType === "conditional" && (
          <>
            <Field
              label="Preço de acionamento"
              unit={market.quote}
              value={triggerPrice}
              onChange={setTriggerPrice}
              placeholder={formatPrice(lastPrice, market.priceDecimals).replace(/,/g, "")}
            />
            <div className="flex gap-2">
              <div className="min-w-0 flex-1">
                {condExec === "limit" ? (
                  <Field
                    label="Preço"
                    unit={market.quote}
                    value={price}
                    onChange={onPriceChange}
                  />
                ) : (
                  <div className="flex min-h-14 items-center rounded-md bg-term-field px-3 text-sm text-term-muted">
                    Melhor preço de mercado
                  </div>
                )}
              </div>
              <div className="flex min-h-14 items-center rounded-md bg-term-field px-3">
                <MenuSelect
                  label="Tipo de execução"
                  value={condExec}
                  onChange={setCondExec}
                  options={[
                    ["limit", "Limite"],
                    ["market", "Mercado"],
                  ]}
                />
              </div>
            </div>
          </>
        )}
        {orderType === "limit" && (
          <Field
            label="Preço"
            unit={market.quote}
            value={price}
            onChange={onPriceChange}
            suffix={
              <button
                type="button"
                onClick={() => lastPrice && onPriceChange(lastPrice.toFixed(market.priceDecimals))}
                className="shrink-0 text-xs font-semibold text-term-accent hover:opacity-80"
              >
                Último
              </button>
            }
          />
        )}

        {orderType === "market" ? (
          <Field
            label={qtyMode === "usdt" ? "Valor" : "Quantidade"}
            unit={
              <MenuSelect
                label="Unidade da ordem"
                value={qtyMode}
                onChange={(next) => {
                  if (next === qtyMode) return
                  setQty(
                    next === "usdt"
                      ? notional > 0
                        ? notional.toFixed(2)
                        : ""
                      : qtyNum > 0
                        ? qtyNum.toFixed(market.qtyDecimals)
                        : "",
                  )
                  setQtyMode(next)
                }}
                options={[
                  ["usdt", "USD"],
                  ["base", market.qtyUnit],
                ]}
                className="text-sm"
              />
            }
            value={qty}
            onChange={(v) => {
              setQty(v)
              setPercent(0)
            }}
          />
        ) : (
          <Field
            label="Quantidade"
            unit={market.qtyUnit}
            value={baseFieldValue}
            onChange={(v) => {
              setQtyMode("base")
              setQty(v)
              setPercent(0)
            }}
          />
        )}

        <div className="px-2 pt-1">
          <div className="relative">
            <div aria-hidden className="pointer-events-none absolute inset-x-0 top-1/2 z-10 h-0">
              {PERCENT_MARKS.map((p) => (
                <span
                  key={p}
                  style={{ left: `${p}%` }}
                  className={cn(
                    "absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-term-panel",
                    p <= percent && percent > 0 ? "border-term-accent" : "border-term-muted",
                    p === 0 && "opacity-0",
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
              className={ACCENT_SLIDER}
            />
          </div>
          <div className="mt-2 flex justify-between text-xs tabular-nums text-term-muted">
            <button onClick={() => applyPercent(0)} className="hover:text-term-text">
              0
            </button>
            {percent > 0 && percent < 100 && <span className="font-semibold text-term-accent">{percent}%</span>}
            <button onClick={() => applyPercent(100)} className="hover:text-term-text">
              100%
            </button>
          </div>
        </div>

        {orderType === "market" ? (
          <p className="-mt-2 text-right text-xs tabular-nums text-term-muted">
            {hasQty
              ? qtyMode === "usdt"
                ? `≈ ${qtyNum.toFixed(market.qtyDecimals)} ${market.qtyUnit}`
                : `≈ ${formatUsd(notional)} USD`
              : "-- USD"}
          </p>
        ) : (
        <div className="flex flex-col gap-1">
          <Field
            label="Valor da ordem"
            unit="USD"
            value={valueFieldValue}
            onChange={(v) => {
              setQtyMode("usdt")
              setQty(v)
              setPercent(0)
            }}
          />
          <p className="text-right text-xs tabular-nums text-term-muted">
            {hasQty ? `≈ ${qtyNum.toFixed(market.qtyDecimals)} ${market.qtyUnit}` : "-- USD"}
          </p>
        </div>
        )}

        <dl className="flex flex-col gap-2 rounded-md border border-term-line px-3 py-3">
          <Row label={isBuy ? "Quant. máxima de compra" : "Quant. máxima de venda"}>
            {authenticated ? maxQty.toFixed(market.qtyDecimals) : "--"} {market.qtyUnit}
          </Row>
          <Row label="Custo">
            <span className={isBuy ? "text-long" : "text-short"}>
              {formatUsd(isBuy ? costLong : costShort)} USD
            </span>
          </Row>
          <Row label="Preço de liquidação">{formatPrice(liq, market.priceDecimals)}</Row>
        </dl>

        <div className="flex flex-col gap-3 text-[13px] font-medium text-term-text">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Checkbox
                aria-label="Ativar TP/SL"
                className={ACCENT_CHECKBOX}
                checked={tpslEnabled}
                onCheckedChange={(v) => setTpslEnabled(v === true)}
              />
              <HintPopover label="TP/SL">
                Os usuários podem definir o Take-Profit/Stop-Loss (TP/SL) para a ordem atual. Assim que a ordem for
                totalmente executada, o sistema colocará ordens TP/SL com base no preço predefinido e na quantidade da
                ordem. Se a quantidade da sua ordem for pequena, a ordem TP/SL poderá não ser colocada com sucesso se a
                plataforma aumentar a quantidade mínima da ordem no momento da execução ou se a quantidade da sua ordem
                cair abaixo do requisito mínimo após a redução da taxa de transação.
              </HintPopover>
            </div>
            {tpslEnabled && (
              <button
                type="button"
                onClick={() => setTpslMode((m) => (m === "advanced" ? "basic" : "advanced"))}
                aria-label={tpslMode === "advanced" ? "Modo avançado — trocar para básico" : "Modo básico — trocar para avançado"}
                className="flex items-center gap-1.5 text-[13px] font-medium text-term-text hover:text-term-accent"
              >
                {tpslMode === "advanced" ? "Avançado" : "Básico"}
                <ArrowLeftRight className="size-3.5 text-term-muted" aria-hidden />
              </button>
            )}
          </div>
          {tpslEnabled && tpslMode === "advanced" && (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setAdvancedOpen(true)}
                disabled={!(tpSlRef > 0)}
                className="flex h-9 items-center justify-center gap-1.5 rounded-full bg-term-field text-[13px] font-medium text-term-text transition-colors hover:bg-term-line disabled:opacity-40"
              >
                <CirclePlus className="size-4 text-term-muted" aria-hidden />
                TP/SL avançado
              </button>
              {(tpNum > 0 || slNum > 0) && (
                <dl className="flex flex-col gap-1 px-1 text-xs">
                  {tpNum > 0 && (
                    <div className="flex justify-between gap-2">
                      <dt className="text-term-muted">Take Profit</dt>
                      <dd className="font-semibold tabular-nums text-long">{formatPrice(tpNum, market.priceDecimals)}</dd>
                    </div>
                  )}
                  {slNum > 0 && (
                    <div className="flex justify-between gap-2">
                      <dt className="text-term-muted">Stop Loss</dt>
                      <dd className="font-semibold tabular-nums text-short">{formatPrice(slNum, market.priceDecimals)}</dd>
                    </div>
                  )}
                </dl>
              )}
            </div>
          )}
          {tpslEnabled && tpslMode === "basic" && (
            <div className="flex flex-col gap-2">
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
            initialSide={tpSlSide ?? (isBuy ? "long" : "short")}
            initialTp={tp}
            initialSl={sl}
            onConfirm={({ side: nextSide, tp: nextTp, sl: nextSl }) => {
              setTp(nextTp)
              setSl(nextSl)
              setTpslSide(nextSide)
              setSide(nextSide === "long" ? "buy" : "sell")
            }}
          />

          {orderType === "limit" && (
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-2">
                <Checkbox className={ACCENT_CHECKBOX} checked={postOnly} onCheckedChange={(v) => setPostOnly(v === true)} />
                <span className="underline decoration-term-muted/60 decoration-dashed underline-offset-4">Transação passiva</span>
              </label>
              {!postOnly && (
                <MenuSelect
                  label="Validade da ordem"
                  value={tif as "GTC" | "IOC" | "FOK"}
                  onChange={setTif}
                  className="font-medium"
                  options={[
                    ["GTC", "Good-Till-Canceled (GTC)"],
                    ["IOC", "Immediate-Or-Cancel (IOC)"],
                    ["FOK", "Fill-Or-Kill (FOK)"],
                  ]}
                />
              )}
            </div>
          )}
          {orderType === "market" && (
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2">
                <Checkbox
                  className={ACCENT_CHECKBOX}
                  checked={slippageOn}
                  onCheckedChange={(v) => setSlippageOn(v === true)}
                />
                <span className="underline decoration-term-muted/60 decoration-dashed underline-offset-4">
                  Slippage máximo
                </span>
              </label>
              {slippageOn && (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    {["0.1", "0.5", "1"].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setSlippage(v)}
                        className={cn(
                          "flex-1 rounded-md border py-1.5 text-xs font-semibold tabular-nums",
                          slippage === v
                            ? "border-term-accent text-term-accent"
                            : "border-term-line text-term-muted hover:text-term-text",
                        )}
                      >
                        {v}%
                      </button>
                    ))}
                    <label className="flex flex-1 items-center rounded-md border border-term-line px-2 focus-within:border-term-accent">
                      <span className="sr-only">Slippage personalizado</span>
                      <input
                        inputMode="decimal"
                        value={slippage}
                        onChange={(e) => setSlippage(sanitizeDecimalInput(e.target.value))}
                        className="h-7 w-full min-w-0 bg-transparent text-right text-xs font-semibold tabular-nums text-term-text outline-none"
                      />
                      <span className="text-xs text-term-muted">%</span>
                    </label>
                  </div>
                  <p className="text-[11px] leading-relaxed text-term-muted">
                    {lastPrice
                      ? `A ordem só executa até ${formatPrice(
                          lastPrice * (1 + ((isBuy ? 1 : -1) * slippagePct) / 100),
                          market.priceDecimals,
                        )} ${market.quote}; acima disso é cancelada.`
                      : "Aguardando preço de mercado."}
                  </p>
                </div>
              )}
            </div>
          )}
          <label className="flex items-center gap-2">
            <Checkbox className={ACCENT_CHECKBOX} checked={reduceOnly} onCheckedChange={(v) => setReduceOnly(v === true)} />
            <span className="underline decoration-term-muted/60 decoration-dashed underline-offset-4">Somente reduzir</span>
          </label>
        </div>

        {!configured ? (
          <p className="rounded-md bg-short/10 p-3 text-xs leading-relaxed text-short">
            Banco de dados não configurado. Configure o Supabase nas variáveis do projeto para operar.
          </p>
        ) : authenticated ? (
          <div className="flex flex-col gap-2">
            <button
              onClick={() => submit(side)}
              disabled={blocked}
              aria-describedby={sideReason ? "order-blocked-reason" : undefined}
              className={cn(
                "rounded-full py-3 text-base font-bold text-term-text transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40",
                isBuy ? "bg-long" : "bg-short",
              )}
            >
              {submitting === side ? "Enviando..." : isBuy ? "Comprar / Long" : "Vender / Short"}
            </button>
            {sideReason && (
              <p id="order-blocked-reason" role="status" className="text-xs leading-relaxed text-term-muted">
                {sideReason}
              </p>
            )}
            {noBalance && account === "real" && (
              <Link
                href="/deposit"
                className="rounded-full bg-term-accent py-2.5 text-center text-sm font-semibold text-term-bg hover:opacity-90"
              >
                Depositar
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Link
              href="/auth/sign-up"
              className="rounded-full bg-term-accent py-2.5 text-center text-sm font-semibold text-term-bg hover:opacity-90"
            >
              Cadastrar
            </Link>
            <Link
              href="/auth/login"
              className="rounded-full bg-term-field py-2.5 text-center text-sm font-semibold text-term-text hover:opacity-90"
            >
              Entrar
            </Link>
          </div>
        )}

        <p className="flex items-center gap-1.5 text-xs text-term-muted">
          <Percent className="size-3.5" aria-hidden />
          Taxa: maker {(MAKER_FEE * 100).toFixed(3)}% · taker {(TAKER_FEE * 100).toFixed(3)}%
        </p>

        <button
          onClick={() => setLeverageOpen(true)}
          className="flex items-center justify-between gap-2 border-t border-term-line pt-3 text-[13px]"
        >
          <span className="text-term-muted">Alternar modo de margem</span>
          <span className="flex items-center gap-0.5 font-semibold text-term-text">
            {marginMode === "cross" ? "Margem cruzada" : "Margem isolada"}
            <ChevronRight className="size-4 text-term-muted" aria-hidden />
          </span>
        </button>
      </div>

      <Link
        href="/suporte"
        className="flex shrink-0 items-center justify-center gap-2 border-t border-term-line bg-term-accent/10 py-2.5 text-[13px] font-semibold text-term-accent transition-colors hover:bg-term-accent/20"
      >
        <Headset className="size-4" aria-hidden />
        Atendimento ao cliente
      </Link>
    </section>
  )
}

