"use client"

import { useState } from "react"
import { Minus, Plus } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"
import {
  TAKER_FEE,
  estimateClosePnl,
  formatPrice,
  formatUsd,
  liquidationPrice,
  parseDecimalInput,
  sanitizeDecimalInput,
  type FuturesMarket,
} from "@/lib/futures/markets"

type Side = "long" | "short"
type Kind = "tp" | "sl"
type PctMode = "change" | "roi"

interface TpSlAdvancedDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  market: FuturesMarket
  refPrice: number
  refLabel: string
  lastPrice: number | null
  qty: number
  leverage: number
  feeRate?: number
  initialSide: Side
  initialTp: string
  initialSl: string
  onConfirm: (values: { side: Side; tp: string; sl: string }) => void
}

const SLIDER_MAX: Record<Kind, number> = { tp: 25, sl: 10 }

/** Direção do alvo: +1 quando o preço precisa subir para atingir o alvo, −1 quando precisa cair. */
function targetDirection(side: Side, kind: Kind) {
  return (side === "long") === (kind === "tp") ? 1 : -1
}

function priceFromChange(ref: number, side: Side, kind: Kind, changePct: number) {
  return ref * (1 + (targetDirection(side, kind) * changePct) / 100)
}

function changeFromPrice(ref: number, side: Side, kind: Kind, price: number) {
  return ((price / ref - 1) * 100) / targetDirection(side, kind)
}

function trimNumber(n: number, decimals: number) {
  return Number(n.toFixed(decimals)).toString()
}

function targetError(kind: Kind, side: Side, ref: number, price: number, liq: number | null, decimals: number) {
  const dir = side === "long" ? "Long" : "Short"
  const name = kind === "tp" ? "Take Profit" : "Stop Loss"
  const mustBeAbove = targetDirection(side, kind) === 1
  if (mustBeAbove ? price <= ref : price >= ref) {
    return `Em ${dir}, o ${name} deve ser ${mustBeAbove ? "maior" : "menor"} que ${formatPrice(ref, decimals)}.`
  }
  if (kind === "sl" && liq != null && (side === "long" ? price <= liq : price >= liq)) {
    return `Este Stop Loss passa do preço de liquidação (${formatPrice(liq, decimals)}). A posição seria liquidada antes.`
  }
  return null
}

function PriceStepper({
  value,
  onChange,
  step,
  decimals,
  fallback,
  label,
}: {
  value: string
  onChange: (v: string) => void
  step: number
  decimals: number
  fallback: number
  label: string
}) {
  const bump = (dir: 1 | -1) => {
    const current = parseDecimalInput(value, fallback)
    const base = Number.isFinite(current) && current > 0 ? current : fallback
    const next = Math.max(step, base + dir * step)
    onChange(next.toFixed(decimals))
  }
  return (
    <div className="flex min-w-0 flex-1 items-center rounded-lg border border-term-line bg-term-bg pl-3 transition-colors focus-within:border-primary">
      <input
        inputMode="decimal"
        aria-label={label}
        placeholder="Preço do gatilho"
        value={value}
        onChange={(e) => onChange(sanitizeDecimalInput(e.target.value))}
        className="h-11 w-full min-w-0 bg-transparent text-[15px] font-semibold tabular-nums text-term-text outline-none placeholder:text-sm placeholder:font-normal placeholder:text-term-muted/70"
      />
      <div className="flex shrink-0 items-center">
        <button
          type="button"
          onClick={() => bump(-1)}
          aria-label={`Diminuir ${label}`}
          className="flex size-9 items-center justify-center text-term-muted hover:text-term-text"
        >
          <Minus className="size-4" aria-hidden />
        </button>
        <span aria-hidden className="h-4 w-px bg-term-line" />
        <button
          type="button"
          onClick={() => bump(1)}
          aria-label={`Aumentar ${label}`}
          className="flex size-9 items-center justify-center text-term-muted hover:text-term-text"
        >
          <Plus className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  )
}

function TargetSection({
  kind,
  side,
  market,
  refPrice,
  qty,
  leverage,
  feeRate,
  liq,
  price,
  onPriceChange,
}: {
  kind: Kind
  side: Side
  market: FuturesMarket
  refPrice: number
  qty: number
  leverage: number
  feeRate: number
  liq: number | null
  price: string
  onPriceChange: (v: string) => void
}) {
  const [mode, setMode] = useState<PctMode>("change")
  const [pctDraft, setPctDraft] = useState<string | null>(null)
  const decimals = market.priceDecimals
  const step = 1 / 10 ** decimals
  const factor = mode === "roi" ? leverage : 1
  const sliderMax = SLIDER_MAX[kind] * factor

  const priceNum = parseDecimalInput(price, refPrice)
  const hasPrice = Number.isFinite(priceNum) && priceNum > 0
  const change = hasPrice && refPrice > 0 ? changeFromPrice(refPrice, side, kind, priceNum) : null
  const shownPct = change != null ? change * factor : null
  const pctText = pctDraft ?? (shownPct != null ? trimNumber(shownPct, 2) : "")

  const setFromPct = (pct: number) => {
    if (!(refPrice > 0) || !Number.isFinite(pct)) return
    const next = priceFromChange(refPrice, side, kind, pct / factor)
    onPriceChange(next > 0 ? next.toFixed(decimals) : "")
  }

  const error = hasPrice ? targetError(kind, side, refPrice, priceNum, liq, decimals) : null
  const estimate =
    hasPrice && !error && qty > 0 ? estimateClosePnl(market, side, qty, refPrice, priceNum, leverage, feeRate) : null

  const isTp = kind === "tp"
  const title = isTp ? "Take Profit" : "Stop Loss"
  const marks = [0, 0.25, 0.5, 0.75, 1].map((f) => Number((sliderMax * f).toFixed(1)))
  const sliderValue = Math.min(Math.max(shownPct ?? 0, 0), sliderMax)

  return (
    <fieldset className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <legend className="text-sm font-semibold text-term-text">{title}</legend>
        <label className="flex items-center gap-1.5 text-xs text-term-muted">
          <span className="sr-only">Calcular {title} por</span>
          <select
            value={mode}
            onChange={(e) => {
              setMode(e.target.value as PctMode)
              setPctDraft(null)
            }}
            className="rounded-md border border-term-line bg-term-bg px-2 py-1 text-xs font-medium text-term-text outline-none focus:border-primary"
          >
            <option value="change">Por variação (%)</option>
            <option value="roi">Por ROI (%)</option>
          </select>
        </label>
      </div>

      <div className="flex gap-2">
        <PriceStepper
          label={`Preço do ${title}`}
          value={price}
          onChange={(v) => {
            setPctDraft(null)
            onPriceChange(v)
          }}
          step={step}
          decimals={decimals}
          fallback={refPrice}
        />
        <label className="flex w-28 shrink-0 items-center gap-1 rounded-lg border border-term-line bg-term-bg px-3 transition-colors focus-within:border-primary">
          <span className="sr-only">{mode === "roi" ? "ROI" : "Variação"} do {title} em porcentagem</span>
          <span aria-hidden className={cn("text-sm font-semibold", isTp ? "text-long" : "text-short")}>
            {isTp ? "+" : "−"}
          </span>
          <input
            inputMode="decimal"
            placeholder={isTp ? "Lucro" : "Perda"}
            value={pctText}
            onChange={(e) => {
              const raw = sanitizeDecimalInput(e.target.value)
              setPctDraft(raw)
              const n = parseDecimalInput(raw)
              if (!raw) onPriceChange("")
              else if (Number.isFinite(n) && n > 0) setFromPct(n)
            }}
            onBlur={() => setPctDraft(null)}
            className="h-11 w-full min-w-0 bg-transparent text-[15px] font-semibold tabular-nums text-term-text outline-none placeholder:text-sm placeholder:font-normal placeholder:text-term-muted/70"
          />
          <span aria-hidden className="text-sm font-semibold text-term-muted">
            %
          </span>
        </label>
      </div>

      <div className="px-1">
        <Slider
          min={0}
          max={sliderMax}
          step={mode === "roi" ? 1 : 0.1}
          value={[sliderValue]}
          onValueChange={([v]) => {
            setPctDraft(null)
            if (v <= 0) onPriceChange("")
            else setFromPct(v)
          }}
          aria-label={`${title} em porcentagem`}
          className={cn(isTp ? "[&_[data-slot=slider-range]]:bg-long" : "[&_[data-slot=slider-range]]:bg-short")}
        />
        <div className="mt-2 flex justify-between text-[11px] tabular-nums text-term-muted">
          {marks.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setPctDraft(null)
                if (m <= 0) onPriceChange("")
                else setFromPct(m)
              }}
              className="hover:text-term-text"
            >
              {m}%
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-lg bg-short/10 px-3 py-2.5 text-xs leading-relaxed text-short">
          {error}
        </p>
      ) : hasPrice ? (
        <p className="rounded-lg bg-term-bg px-3 py-2.5 text-xs leading-relaxed text-term-muted">
          Quando o último preço negociado atingir{" "}
          <span className="font-semibold tabular-nums text-term-text">{formatPrice(priceNum, decimals)}</span>, uma
          ordem a mercado de {isTp ? "lucro" : "stop loss"} será acionada
          {estimate ? (
            <>
              , resultando em {estimate.pnl >= 0 ? "um lucro" : "uma perda"} estimado
              {estimate.pnl >= 0 ? "" : "a"} de{" "}
              <span className={cn("font-semibold tabular-nums", estimate.pnl >= 0 ? "text-long" : "text-short")}>
                {formatUsd(Math.abs(estimate.pnl))} BRL
              </span>{" "}
              (ROI {estimate.roi >= 0 ? "+" : "−"}
              {Math.abs(estimate.roi).toFixed(2)}%), já descontadas as taxas.
            </>
          ) : (
            ". Informe a quantidade da ordem para ver o valor estimado."
          )}
        </p>
      ) : null}
    </fieldset>
  )
}

export function TpSlAdvancedDialog({
  open,
  onOpenChange,
  market,
  refPrice,
  refLabel,
  lastPrice,
  qty,
  leverage,
  feeRate = TAKER_FEE,
  initialSide,
  initialTp,
  initialSl,
  onConfirm,
}: TpSlAdvancedDialogProps) {
  const [side, setSide] = useState<Side>(initialSide)
  const [tp, setTp] = useState(initialTp)
  const [sl, setSl] = useState(initialSl)
  const [sessionKey, setSessionKey] = useState(0)

  const decimals = market.priceDecimals
  const liq = refPrice > 0 ? liquidationPrice(side, refPrice, leverage) : null
  const tpNum = parseDecimalInput(tp, refPrice)
  const slNum = parseDecimalInput(sl, refPrice)
  const tpBad = tp !== "" && (!(tpNum > 0) || targetError("tp", side, refPrice, tpNum, liq, decimals) !== null)
  const slBad = sl !== "" && (!(slNum > 0) || targetError("sl", side, refPrice, slNum, liq, decimals) !== null)
  const canConfirm = refPrice > 0 && !tpBad && !slBad

  const switchSide = (next: Side) => {
    if (next === side) return
    setSide(next)
    setTp("")
    setSl("")
    setSessionKey((k) => k + 1)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) {
          setSide(initialSide)
          setTp(initialTp)
          setSl(initialSl)
          setSessionKey((k) => k + 1)
        }
        onOpenChange(o)
      }}
    >
      <DialogContent className="max-h-[92dvh] gap-5 overflow-y-auto border-term-line bg-term-panel font-sans text-term-text sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Adicionar TP/SL</DialogTitle>
          <DialogDescription className="text-term-muted">
            Defina o preço de saída ou a porcentagem. O lucro e a perda são calculados com a sua alavancagem e as taxas.
          </DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-3 gap-2 border-b border-term-line pb-4">
          <div className="flex flex-col gap-1">
            <dt className="text-[11px] text-term-muted">{refLabel}</dt>
            <dd className="text-sm font-semibold tabular-nums">{formatPrice(refPrice || null, decimals)}</dd>
          </div>
          <div className="flex flex-col gap-1 text-center">
            <dt className="text-[11px] text-term-muted">Quantidade</dt>
            <dd className="text-sm font-semibold tabular-nums">
              {qty > 0 ? qty.toFixed(market.qtyDecimals) : "--"} {market.qtyUnit}
            </dd>
          </div>
          <div className="flex flex-col gap-1 text-right">
            <dt className="text-[11px] text-term-muted">Último preço</dt>
            <dd className="text-sm font-semibold tabular-nums">{formatPrice(lastPrice, decimals)}</dd>
          </div>
        </dl>

        <div role="radiogroup" aria-label="Direção da posição" className="grid grid-cols-2 gap-1 rounded-lg bg-term-bg p-1">
          {(
            [
              ["long", "Long"],
              ["short", "Short"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={side === k}
              onClick={() => switchSide(k)}
              className={cn(
                "rounded-md py-2 text-sm font-semibold transition-colors",
                side === k
                  ? k === "long"
                    ? "bg-long text-term-text"
                    : "bg-short text-term-text"
                  : "text-term-muted hover:text-term-text",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <TargetSection
          key={`tp-${sessionKey}`}
          kind="tp"
          side={side}
          market={market}
          refPrice={refPrice}
          qty={qty}
          leverage={leverage}
          feeRate={feeRate}
          liq={liq}
          price={tp}
          onPriceChange={setTp}
        />
        <TargetSection
          key={`sl-${sessionKey}`}
          kind="sl"
          side={side}
          market={market}
          refPrice={refPrice}
          qty={qty}
          leverage={leverage}
          feeRate={feeRate}
          liq={liq}
          price={sl}
          onPriceChange={setSl}
        />

        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            disabled={!canConfirm}
            onClick={() => {
              onConfirm({ side, tp, sl })
              onOpenChange(false)
            }}
            className="rounded-full bg-primary py-3 text-sm font-bold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Confirmar
          </button>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-full border border-term-line py-3 text-sm font-bold text-term-text hover:bg-term-bg"
          >
            Cancelar
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
