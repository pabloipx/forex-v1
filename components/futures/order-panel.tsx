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
        "flex items-center gap-2 rounded-md border border-transparent bg-term-bg px-3 py-2 focus-within:border-primary",
        disabled && "opacity-60",
      )}
    >
      <span className="shrink-0 text-xs text-term-muted">{label}</span>
      <input
        inputMode="decimal"
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        onChange={(e) => onChange(sanitizeDecimalInput(e.target.value))}
        className="w-full min-w-0 bg-transparent text-right font-mono text-sm text-term-text outline-none placeholder:text-term-muted"
      />
      <span className="shrink-0 text-xs font-medium text-term-text">{unit}</span>
    </label>
  )
}

const LEVERAGE_MARKS = (max: number) => [1, ...[0.1, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f))]

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
                "rounded-md border py-2 text-sm font-semibold",
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
        <div className="flex items-center justify-between rounded-md bg-term-bg px-3 py-2">
          <button
            className="px-2 text-lg text-term-muted hover:text-term-text"
            onClick={() => setDraft((d) => Math.max(1, d - 1))}
            aria-label="Diminuir"
          >
            −
          </button>
          <span className="font-mono text-xl font-bold">{draft}x</span>
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
        <div className="rounded-md bg-term-bg p-3 text-xs leading-relaxed">
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
          className="rounded-md bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
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
  const cost = Math.max(costLong, costShort)

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
    const tpSlRef = orderType === "market" ? execPrice : orderType === "conditional" ? triggerNum || execPrice : priceNum || execPrice
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
      onSubmitted()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSubmitting(null)
    }
  }

  const hasQty = qtyNum > 0
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
    <section aria-label="Enviar ordem" className="flex h-full flex-col gap-3 overflow-y-auto bg-term-panel p-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-term-text">Trade</h2>
        <span className="text-[11px] text-term-muted">
          {account === "demo" ? "Conta demo" : "Conta real"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => setLeverageOpen(true)}
          className="rounded-md bg-term-bg py-1.5 text-xs font-semibold text-term-text hover:bg-term-line"
        >
          {marginMode === "cross" ? "Cruzada" : "Isolada"}
        </button>
        <button
          onClick={() => setLeverageOpen(true)}
          className="rounded-md bg-term-bg py-1.5 font-mono text-xs font-semibold text-term-text hover:bg-term-line"
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

      <div role="tablist" aria-label="Tipo de ordem" className="flex gap-4 text-sm phone:gap-3 phone:text-xs">
        {(
          [
            ["limit", "Limitada"],
            ["market", "A mercado"],
            ["conditional", "Condicional"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            role="tab"
            aria-selected={orderType === k}
            onClick={() => setOrderType(k)}
            className={cn("font-semibold", orderType === k ? "text-primary" : "text-term-muted hover:text-term-text")}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className="text-term-muted">Disponível</span>
        <span className="font-mono text-term-text">
          {authenticated ? formatUsd(balance) : "--"} BRL
          {authenticated && account === "real" && (
            <Link href="/deposit" className="ml-1.5 text-primary hover:underline">
              Depositar
            </Link>
          )}
        </span>
      </div>

      {orderType === "conditional" && (
        <Field
          label="Disparo"
          unit={market.quote}
          value={triggerPrice}
          onChange={setTriggerPrice}
          placeholder={formatPrice(lastPrice, market.priceDecimals).replace(/,/g, "")}
        />
      )}
      {orderType === "market" ? (
        <div className="flex items-center justify-between rounded-md bg-term-bg px-3 py-2 text-xs text-term-muted">
          <span>Preço</span>
          <span>Melhor preço de mercado</span>
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
            className="rounded-md bg-term-bg px-2.5 text-xs font-semibold text-term-text hover:bg-term-line"
          >
            Último
          </button>
        </div>
      )}

      <div className="flex gap-2">
        <div className="flex-1">
          <Field
            label={qtyMode === "usdt" ? "Valor" : "Qtd"}
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
          className="rounded-md bg-term-bg px-2.5 text-xs font-semibold text-term-text hover:bg-term-line"
        >
          {qtyMode === "base" ? "USDT" : market.qtyUnit}
        </button>
      </div>
      {qtyMode === "usdt" && hasQty && (
        <p className="-mt-1 text-right font-mono text-[11px] text-term-muted">
          {"≈ "}
          {qtyNum.toFixed(market.qtyDecimals)} {market.qtyUnit}
        </p>
      )}

      <div className="px-1">
        <Slider min={0} max={100} step={1} value={[percent]} onValueChange={([v]) => applyPercent(v)} />
        <div className="mt-1.5 flex justify-between text-[11px] text-term-muted">
          {[0, 25, 50, 75, 100].map((p) => (
            <button key={p} onClick={() => applyPercent(p)} className="hover:text-term-text">
              {p}%
            </button>
          ))}
        </div>
      </div>

      <dl className="flex flex-col gap-1 text-xs">
        <div className="flex justify-between">
          <dt className="text-term-muted">Valor da ordem</dt>
          <dd className="font-mono text-term-text">{formatUsd(notional)} BRL</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-term-muted">Custo Long</dt>
          <dd className="font-mono text-long">{formatUsd(costLong)} BRL</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-term-muted">Custo Short</dt>
          <dd className="font-mono text-short">{formatUsd(costShort)} BRL</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-term-muted">Qtd máx.</dt>
          <dd className="font-mono text-term-text">
            {authenticated ? maxQty.toFixed(market.qtyDecimals) : "--"} {market.qtyUnit}
          </dd>
        </div>
      </dl>

      <div className="flex flex-col gap-2 text-xs text-term-text">
        <label className="flex items-center gap-2">
          <Checkbox className="border-term-muted" checked={tpslEnabled} onCheckedChange={(v) => setTpslEnabled(v === true)} />
          TP/SL
        </label>
        {tpslEnabled && (
          <div className="flex flex-col gap-2">
            <Field label="Take Profit" unit={market.quote} value={tp} onChange={setTp} />
            <Field label="Stop Loss" unit={market.quote} value={sl} onChange={setSl} />
          </div>
        )}
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
              className="rounded bg-term-bg px-2 py-1 text-term-text outline-none"
            >
              <option value="GTC">Good-Till-Canceled</option>
              <option value="IOC">Immediate-Or-Cancel</option>
              <option value="FOK">Fill-Or-Kill</option>
            </select>
          </label>
        )}
      </div>

      {!configured ? (
        <p className="rounded-md bg-short/10 p-3 text-xs leading-relaxed text-short">
          Banco de dados não configurado. Configure o Supabase nas variáveis do projeto para operar.
        </p>
      ) : authenticated ? (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => submit("buy")}
              disabled={blockedLong}
              aria-describedby={blockedReason ? "order-blocked-reason" : undefined}
              className="rounded-md bg-long py-2.5 text-sm font-semibold text-term-text hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:opacity-40"
            >
              {submitting === "buy" ? "Enviando..." : "Abrir Long"}
            </button>
            <button
              onClick={() => submit("sell")}
              disabled={blockedShort}
              aria-describedby={blockedReason ? "order-blocked-reason" : undefined}
              className="rounded-md bg-short py-2.5 text-sm font-semibold text-term-text hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:opacity-40"
            >
              {submitting === "sell" ? "Enviando..." : "Abrir Short"}
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
              className="rounded-md bg-primary py-2.5 text-center text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Depositar
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Link
            href="/auth/sign-up"
            className="rounded-md bg-primary py-2.5 text-center text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            Cadastrar
          </Link>
          <Link
            href="/auth/login"
            className="rounded-md bg-term-line py-2.5 text-center text-sm font-semibold text-term-text hover:opacity-90"
          >
            Entrar
          </Link>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        <dt className="text-term-muted">Liq. Long</dt>
        <dt className="text-right text-term-muted">Liq. Short</dt>
        <dd className="font-mono text-term-text">{formatPrice(liqLong, market.priceDecimals)}</dd>
        <dd className="text-right font-mono text-term-text">{formatPrice(liqShort, market.priceDecimals)}</dd>
      </dl>

      <p className="mt-auto text-[11px] leading-relaxed text-term-muted">
        Taxas: maker {(MAKER_FEE * 100).toFixed(3)}% · taker {(TAKER_FEE * 100).toFixed(3)}%
      </p>
    </section>
  )
}
