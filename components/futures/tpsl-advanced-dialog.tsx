"use client"

import { useState } from "react"
import { ChevronDown, GripVertical, Minus, Plus } from "lucide-react"
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
type CalcMode = "change" | "pnl"

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
const SLIDER_MARKS: Record<Kind, number[]> = { tp: [0, 5, 10, 15, 20, 25], sl: [0, 5, 10] }
const MODE_LABEL: Record<CalcMode, string> = { change: "Por variação (%)", pnl: "Por P&L" }

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
    <div className="flex min-w-0 flex-[3] items-center rounded-md bg-term-field pl-3 ring-1 ring-transparent transition-shadow focus-within:ring-term-accent">
      <input
        inputMode="decimal"
        aria-label={label}
        placeholder="Preço de acionamento"
        value={value}
        onChange={(e) => onChange(sanitizeDecimalInput(e.target.value))}
        className="h-11 w-full min-w-0 bg-transparent text-sm font-semibold tabular-nums text-term-text outline-none placeholder:font-normal placeholder:text-term-muted"
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

function ConditionDialog({
  open,
  onOpenChange,
  value,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  value: CalcMode
  onConfirm: (mode: CalcMode) => void
}) {
  const [draft, setDraft] = useState<CalcMode>(value)
  const options: { k: CalcMode; text: string }[] = [
    { k: "change", text: "Insira a alteração (%) esperada para calcular os preços de acionamento para ordens TP/SL." },
    { k: "pnl", text: "Insira seu P&L esperado para calcular os preços de acionamento para ordens TP/SL." },
  ]
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) setDraft(value)
        onOpenChange(o)
      }}
    >
      <DialogContent className="gap-5 border-term-line bg-term-field font-sans text-term-text sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Definir condições de TP/SL</DialogTitle>
          <DialogDescription className="sr-only">Escolha como calcular os preços de acionamento.</DialogDescription>
        </DialogHeader>
        <div role="radiogroup" aria-label="Condição de TP/SL" className="flex flex-col gap-4">
          {options.map(({ k, text }) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={draft === k}
              onClick={() => setDraft(k)}
              className="flex items-start gap-3 text-left"
            >
              <span
                aria-hidden
                className={cn(
                  "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border-2",
                  draft === k ? "border-term-accent" : "border-term-muted",
                )}
              >
                {draft === k && <span className="size-1.5 rounded-full bg-term-accent" />}
              </span>
              <span className="flex flex-col gap-1">
                <span className="text-sm font-semibold">{MODE_LABEL[k]}</span>
                <span className="text-xs leading-relaxed text-term-muted">{text}</span>
              </span>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => {
              onConfirm(draft)
              onOpenChange(false)
            }}
            className="rounded-full bg-term-accent py-2.5 text-sm font-semibold text-term-bg hover:opacity-90"
          >
            Confirmar
          </button>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-full border border-term-text/60 py-2.5 text-sm font-semibold text-term-text hover:bg-term-panel"
          >
            Cancelar
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Encontra o preço que gera o P&L desejado (busca binária sobre a estimativa com taxas). */
function priceFromPnl(
  market: FuturesMarket,
  side: Side,
  kind: Kind,
  qty: number,
  ref: number,
  leverage: number,
  feeRate: number,
  targetPnl: number,
) {
  const dir = targetDirection(side, kind)
  let lo = 0
  let hi = kind === "sl" && side === "long" ? 99.99 : 1000
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    const price = ref * (1 + (dir * mid) / 100)
    const { pnl } = estimateClosePnl(market, side, qty, ref, price, leverage, feeRate)
    const reached = kind === "tp" ? pnl >= targetPnl : pnl <= -targetPnl
    if (reached) hi = mid
    else lo = mid
  }
  return ref * (1 + (dir * hi) / 100)
}

function TargetSection({
  kind,
  side,
  mode,
  onOpenMode,
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
  mode: CalcMode
  onOpenMode: () => void
  market: FuturesMarket
  refPrice: number
  qty: number
  leverage: number
  feeRate: number
  liq: number | null
  price: string
  onPriceChange: (v: string) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const decimals = market.priceDecimals
  const step = 1 / 10 ** decimals
  const sliderMax = SLIDER_MAX[kind]

  const priceNum = parseDecimalInput(price, refPrice)
  const hasPrice = Number.isFinite(priceNum) && priceNum > 0
  const change = hasPrice && refPrice > 0 ? changeFromPrice(refPrice, side, kind, priceNum) : null
  const estimate =
    hasPrice && qty > 0 && refPrice > 0 ? estimateClosePnl(market, side, qty, refPrice, priceNum, leverage, feeRate) : null
  const error = hasPrice ? targetError(kind, side, refPrice, priceNum, liq, decimals) : null

  const shownValue =
    mode === "change"
      ? change != null
        ? trimNumber(change, 2)
        : ""
      : estimate && !error
        ? Math.abs(estimate.pnl).toFixed(2)
        : ""
  const valueText = draft ?? shownValue

  const setFromChange = (pct: number) => {
    if (!(refPrice > 0) || !Number.isFinite(pct)) return
    const next = priceFromChange(refPrice, side, kind, pct)
    onPriceChange(next > 0 ? next.toFixed(decimals) : "")
  }

  const setFromValue = (n: number) => {
    if (mode === "change") return setFromChange(n)
    if (!(refPrice > 0) || !(qty > 0)) return
    const next = priceFromPnl(market, side, kind, qty, refPrice, leverage, feeRate, n)
    onPriceChange(next > 0 ? next.toFixed(decimals) : "")
  }

  const isTp = kind === "tp"
  const title = isTp ? "Take Profit" : "Stop Loss"
  const sliderValue = Math.min(Math.max(change ?? 0, 0), sliderMax)
  const pnlDisabled = mode === "pnl" && !(qty > 0)

  return (
    <fieldset className="flex flex-col gap-3">
      <legend className="sr-only">{title}</legend>
      <button
        type="button"
        onClick={onOpenMode}
        className="flex items-center gap-1.5 self-start text-sm font-medium text-term-text hover:text-term-accent"
      >
        {title}-{MODE_LABEL[mode]}
        <ChevronDown className="size-4 text-term-muted" aria-hidden />
      </button>

      <div className="flex gap-2">
        <PriceStepper
          label={`Preço de acionamento do ${title}`}
          value={price}
          onChange={(v) => {
            setDraft(null)
            onPriceChange(v)
          }}
          step={step}
          decimals={decimals}
          fallback={refPrice}
        />
        <label className="flex min-w-0 flex-[2] items-center gap-1 rounded-md bg-term-field px-3 ring-1 ring-transparent transition-shadow focus-within:ring-term-accent">
          <span className="sr-only">
            {mode === "change" ? "Variação" : "P&L"} do {title}
          </span>
          {!isTp && (
            <span aria-hidden className="text-sm font-semibold text-term-muted">
              −
            </span>
          )}
          <input
            inputMode="decimal"
            disabled={pnlDisabled}
            placeholder={mode === "change" ? (isTp ? "Aumentar" : "Diminuir") : isTp ? "Lucro" : "Perda"}
            title={pnlDisabled ? "Informe a quantidade da ordem para usar P&L" : undefined}
            value={valueText}
            onChange={(e) => {
              const raw = sanitizeDecimalInput(e.target.value)
              setDraft(raw)
              const n = parseDecimalInput(raw)
              if (!raw) onPriceChange("")
              else if (Number.isFinite(n) && n > 0) setFromValue(n)
            }}
            onBlur={() => setDraft(null)}
            className="h-11 w-full min-w-0 bg-transparent text-sm font-semibold tabular-nums text-term-text outline-none placeholder:font-normal placeholder:text-term-muted disabled:cursor-not-allowed"
          />
          <span aria-hidden className="shrink-0 text-sm font-semibold text-term-muted">
            {mode === "change" ? "%" : "USD"}
          </span>
        </label>
      </div>

      <div className="px-2 pt-1">
        <div className="relative">
          <div aria-hidden className="pointer-events-none absolute inset-x-0 top-1/2 z-10 h-0">
            {SLIDER_MARKS[kind].map((m) => (
              <span
                key={m}
                style={{ left: `${(m / sliderMax) * 100}%` }}
                className={cn(
                  "absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-term-panel",
                  m <= sliderValue && sliderValue > 0 ? "border-term-accent" : "border-term-muted",
                  m === 0 && "opacity-0",
                )}
              />
            ))}
          </div>
          <Slider
            min={0}
            max={sliderMax}
            step={0.1}
            value={[sliderValue]}
            onValueChange={([v]) => {
              setDraft(null)
              if (v <= 0) onPriceChange("")
              else setFromChange(v)
            }}
            aria-label={`${title} em porcentagem`}
            className="[&_[data-slot=slider-range]]:bg-term-accent [&_[data-slot=slider-thumb]]:border-term-accent [&_[data-slot=slider-thumb]]:bg-term-panel [&_[data-slot=slider-track]]:bg-term-line"
          />
        </div>
        <div className="mt-2 flex justify-between text-xs tabular-nums text-term-muted">
          <button type="button" onClick={() => onPriceChange("")} className="hover:text-term-text">
            0
          </button>
          {sliderValue > 0 && sliderValue < sliderMax && (
            <span className="font-semibold text-term-accent">{trimNumber(sliderValue, 1)}%</span>
          )}
          <button type="button" onClick={() => setFromChange(sliderMax)} className="hover:text-term-text">
            {sliderMax}%
          </button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="text-xs leading-relaxed text-short">
          {error}
        </p>
      ) : hasPrice ? (
        <p className="text-xs leading-relaxed text-term-muted">
          Quando o último preço negociado atingir{" "}
          <span className="font-semibold tabular-nums text-term-text">{formatPrice(priceNum, decimals)}</span>, uma
          ordem a mercado de {isTp ? "Take Profit" : "Stop Loss"} será acionada
          {estimate ? (
            <>
              . P&L estimado:{" "}
              <span className={cn("font-semibold tabular-nums", estimate.pnl >= 0 ? "text-long" : "text-short")}>
                {estimate.pnl >= 0 ? "+" : "−"}
                {formatUsd(Math.abs(estimate.pnl))} USD
              </span>
              .
            </>
          ) : (
            "."
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
  const [tp, setTp] = useState(initialTp)
  const [sl, setSl] = useState(initialSl)
  const [mode, setMode] = useState<CalcMode>("change")
  const [modeOpen, setModeOpen] = useState(false)
  const [sessionKey, setSessionKey] = useState(0)

  const side = initialSide
  const decimals = market.priceDecimals
  const liq = refPrice > 0 ? liquidationPrice(side, refPrice, leverage) : null
  const tpNum = parseDecimalInput(tp, refPrice)
  const slNum = parseDecimalInput(sl, refPrice)
  const tpBad = tp !== "" && (!(tpNum > 0) || targetError("tp", side, refPrice, tpNum, liq, decimals) !== null)
  const slBad = sl !== "" && (!(slNum > 0) || targetError("sl", side, refPrice, slNum, liq, decimals) !== null)
  const canConfirm = refPrice > 0 && !tpBad && !slBad

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (o) {
          setTp(initialTp)
          setSl(initialSl)
          setSessionKey((k) => k + 1)
        }
        onOpenChange(o)
      }}
    >
      <DialogContent className="max-h-[92dvh] gap-5 overflow-y-auto border-term-line bg-term-panel font-sans text-term-text sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <GripVertical className="size-4 text-term-muted" aria-hidden />
            Adicionar TP/SL
          </DialogTitle>
          <DialogDescription className="sr-only">
            Defina os preços de acionamento de Take Profit e Stop Loss da ordem.
          </DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-3 gap-2 border-b border-term-line pb-4">
          <div className="flex flex-col gap-1">
            <dt className="text-xs text-term-muted">{refLabel}</dt>
            <dd className="text-sm font-semibold tabular-nums">{formatPrice(refPrice || null, decimals)}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-xs text-term-muted">Quantidade</dt>
            <dd className="text-sm font-semibold tabular-nums">{qty > 0 ? qty.toFixed(market.qtyDecimals) : "--"}</dd>
          </div>
          <div className="flex flex-col gap-1 text-right">
            <dt className="text-xs text-term-muted">Último preço negociado</dt>
            <dd className="text-sm font-semibold tabular-nums">{formatPrice(lastPrice, decimals)}</dd>
          </div>
        </dl>

        {(["tp", "sl"] as const).map((kind) => (
          <TargetSection
            key={`${kind}-${sessionKey}-${mode}`}
            kind={kind}
            side={side}
            mode={mode}
            onOpenMode={() => setModeOpen(true)}
            market={market}
            refPrice={refPrice}
            qty={qty}
            leverage={leverage}
            feeRate={feeRate}
            liq={liq}
            price={kind === "tp" ? tp : sl}
            onPriceChange={kind === "tp" ? setTp : setSl}
          />
        ))}

        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            disabled={!canConfirm}
            onClick={() => {
              onConfirm({ side, tp, sl })
              onOpenChange(false)
            }}
            className="rounded-full bg-term-accent py-2.5 text-sm font-semibold text-term-bg hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Confirmar
          </button>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="rounded-full border border-term-text/60 py-2.5 text-sm font-semibold text-term-text hover:bg-term-field"
          >
            Cancelar
          </button>
        </div>

        <ConditionDialog open={modeOpen} onOpenChange={setModeOpen} value={mode} onConfirm={setMode} />
      </DialogContent>
    </Dialog>
  )
}
