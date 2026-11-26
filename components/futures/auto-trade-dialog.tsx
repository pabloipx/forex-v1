"use client"

import { useState, type FormEvent } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { MARKET_MAP, type FuturesMarket } from "@/lib/futures/markets"
import type { AutoTradeSettings } from "@/lib/futures/auto-trading"
import type { AccountMode } from "@/lib/futures/types"
import { cn } from "@/lib/utils"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  account: AccountMode
  symbol: string
  availableBalance: number
  authenticated: boolean
  interval: string
  onSelectOneMinute: () => void
  onStart: (settings: AutoTradeSettings) => Promise<void>
}

const inputClass =
  "h-10 w-full rounded-md border border-term-line bg-term-bg px-3 font-mono text-sm text-term-text outline-none focus:border-term-accent"
const fieldClass = "flex min-w-0 flex-col gap-1.5 text-xs text-term-muted"
const money = (n: number) => `US$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export function AutoTradeDialog({
  open,
  onOpenChange,
  account,
  symbol,
  availableBalance,
  authenticated,
  interval,
  onSelectOneMinute,
  onStart,
}: Props) {
  const [marginUsd, setMarginUsd] = useState("25")
  const [leverage, setLeverage] = useState("2")
  const [stopLossPercent, setStopLossPercent] = useState("1")
  const [takeProfitPercent, setTakeProfitPercent] = useState("2")
  const [dailyTargetPercent, setDailyTargetPercent] = useState("1")
  const [dailyLossPercent, setDailyLossPercent] = useState("2")
  const [maxTradesPerDay, setMaxTradesPerDay] = useState("5")
  const [realConfirmed, setRealConfirmed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const market = MARKET_MAP[symbol] as FuturesMarket | undefined
  const maxLeverage = Math.min(10, market?.maxLeverage ?? 10)
  const margin = Number(marginUsd)
  const lev = Number(leverage)
  const sl = Number(stopLossPercent)
  const tp = Number(takeProfitPercent)
  const target = Number(dailyTargetPercent)
  const loss = Number(dailyLossPercent)
  const maxTrades = Number(maxTradesPerDay)
  const valid =
    !!market &&
    Number.isFinite(margin) && margin >= 5 && margin * (1 + lev * 0.001) <= availableBalance &&
    Number.isInteger(lev) && lev >= 1 && lev <= maxLeverage &&
    Number.isFinite(sl) && sl >= 0.1 && sl <= 10 &&
    Number.isFinite(tp) && tp >= 0.1 && tp <= 20 &&
    Number.isFinite(target) && target >= 0.1 && target <= 20 &&
    Number.isFinite(loss) && loss >= 0.1 && loss <= 20 &&
    Number.isInteger(maxTrades) && maxTrades >= 1 && maxTrades <= 20 &&
    (account !== "real" || realConfirmed)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!valid || !market || interval !== "1m" || !authenticated) return
    setSaving(true)
    setError(null)
    try {
      await onStart({
        account,
        symbol: market.symbol,
        marginUsd: margin,
        leverage: lev,
        stopLossPercent: sl,
        takeProfitPercent: tp,
        dailyTargetPercent: target,
        dailyLossPercent: loss,
        maxTradesPerDay: maxTrades,
      })
      onOpenChange(false)
    } catch (err) {
      setError((err as Error).message || "Não foi possível ativar a automação")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto border-term-line bg-term-panel text-term-text sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Automação · TRADER SIGNAL PRO</DialogTitle>
          <DialogDescription className="text-term-muted">
            Configure a execução automática dos sinais CALL (compra) e PUT (venda). O bot só lê este script e o gráfico atual.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-term-line bg-term-bg px-3 py-2 text-sm">
          <span className="font-semibold text-term-text">{symbol} · Isolada</span>
          <span className={cn("rounded px-2 py-1 text-xs font-semibold", account === "demo" ? "bg-primary/15 text-primary" : "bg-short/15 text-short")}>
            Conta {account === "demo" ? "Demo" : "Real"}
          </span>
        </div>

        {interval !== "1m" && (
          <div className="flex flex-col gap-2 rounded-md border border-term-accent/40 bg-term-accent/10 p-3 text-xs text-term-text">
            <p>Este indicador gera sinais somente no intervalo de 1 minuto.</p>
            <button type="button" onClick={onSelectOneMinute} className="self-start rounded bg-term-accent px-3 py-1.5 font-semibold text-term-bg">
              Mudar gráfico para 1m
            </button>
          </div>
        )}

        {!authenticated && (
          <p className="rounded-md border border-short/30 bg-short/10 p-3 text-xs text-short">
            Entre na sua conta para configurar a automação. Nenhuma ordem será enviada sem autenticação.
          </p>
        )}

        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <label className={fieldClass}>
              Margem por entrada (USD)
              <input className={inputClass} type="number" min="5" step="1" value={marginUsd} onChange={(e) => setMarginUsd(e.target.value)} />
              <span>Saldo disponível: {money(availableBalance)}</span>
            </label>
            <label className={fieldClass}>
              Alavancagem isolada
              <input className={inputClass} type="number" min="1" max={maxLeverage} step="1" value={leverage} onChange={(e) => setLeverage(e.target.value)} />
              <span>Máximo neste modo: {maxLeverage}x</span>
            </label>
            <label className={fieldClass}>
              Stop loss por operação (%)
              <input className={inputClass} type="number" min="0.1" max="10" step="0.1" value={stopLossPercent} onChange={(e) => setStopLossPercent(e.target.value)} />
            </label>
            <label className={fieldClass}>
              Take profit por operação (%)
              <input className={inputClass} type="number" min="0.1" max="20" step="0.1" value={takeProfitPercent} onChange={(e) => setTakeProfitPercent(e.target.value)} />
            </label>
            <label className={fieldClass}>
              Meta diária para parar (%)
              <input className={inputClass} type="number" min="0.1" max="20" step="0.1" value={dailyTargetPercent} onChange={(e) => setDailyTargetPercent(e.target.value)} />
            </label>
            <label className={fieldClass}>
              Perda diária máxima (%)
              <input className={inputClass} type="number" min="0.1" max="20" step="0.1" value={dailyLossPercent} onChange={(e) => setDailyLossPercent(e.target.value)} />
            </label>
          </div>

          <label className={fieldClass}>
            Máximo de entradas por dia
            <input className={inputClass} type="number" min="1" max="20" step="1" value={maxTradesPerDay} onChange={(e) => setMaxTradesPerDay(e.target.value)} />
          </label>

          {account === "real" && (
            <label className="flex items-start gap-2 rounded-md border border-short/30 bg-short/10 p-3 text-xs leading-relaxed text-term-text">
              <input type="checkbox" checked={realConfirmed} onChange={(e) => setRealConfirmed(e.target.checked)} className="mt-0.5 accent-short" />
              <span>Confirmo que esta automação enviará ordens na conta real. Posso perder dinheiro; metas não garantem lucro.</span>
            </label>
          )}

          <div className="rounded-md border border-term-line bg-term-bg p-3 text-xs leading-relaxed text-term-muted">
            A meta diária é apenas um limite para parar novas entradas, não uma previsão nem promessa de rendimento. O stop e o take profit são enviados junto com cada ordem. A automação funciona enquanto esta tela do terminal estiver aberta; posições abertas mantêm seus stops mesmo se você parar o bot.
          </div>

          {error && <p role="alert" className="rounded-md border border-short/30 bg-short/10 p-2 text-xs text-short">{error}</p>}
          <button
            type="submit"
            disabled={!valid || interval !== "1m" || !authenticated || saving}
            className="h-11 rounded-md bg-term-accent px-4 text-sm font-bold text-term-bg transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Ativando..." : `Ativar automação · ${account === "demo" ? "Demo" : "Real"}`}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
