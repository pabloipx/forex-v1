"use client"

import { useState } from "react"
import { mutate as globalMutate } from "swr"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

export interface Launch {
  id: string
  symbol: string
  name: string
  description: string | null
  icon_url: string | null
  launch_at: string | null
  presale_price_usd: number | null
  price_usd: number | null
  phase: "presale" | "live" | "ended"
  trade_price_usd: number | null
}

export interface Holding {
  launch_id: string
  qty: number
  invested_usd: number
}

export const fmtUsd = (v: number, max = 2) =>
  v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: max })

export const coinTicker = (symbol: string) => symbol.replace(/USDT$/, "")

const QUICK_AMOUNTS = [500, 1000, 2500, 5000]

export function LaunchTrade({
  coin,
  holding,
  balance,
  authenticated,
  onDone,
}: {
  coin: Launch
  holding?: Holding | null
  balance?: number
  authenticated?: boolean
  onDone: () => void
}) {
  const [side, setSide] = useState<"buy" | "sell">("buy")
  const [value, setValue] = useState("")
  const [busy, setBusy] = useState(false)
  const price = coin.trade_price_usd ?? 0
  const isPresale = coin.phase === "presale"
  const ticker = coinTicker(coin.symbol)
  const amount = Number(value.replace(/\./g, "").replace(",", "."))
  const valid = Number.isFinite(amount) && amount > 0
  const preview = side === "buy" ? (valid && price ? amount / price : 0) : valid ? amount * price : 0

  const submit = async () => {
    if (!valid || busy) return
    setBusy(true)
    try {
      const res = await fetch("/api/launches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ launch_id: coin.id, side, value: amount }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? "Não foi possível concluir")
      toast.success(
        side === "buy"
          ? `Compra de ${json.trade.qty.toLocaleString("pt-BR", { maximumFractionDigits: 6 })} ${ticker} concluída`
          : `Venda concluída: US$ ${fmtUsd(json.trade.amount)}`,
      )
      setValue("")
      await Promise.all([
        globalMutate("/api/launches"),
        globalMutate(`/api/launches/${coin.symbol}`),
        globalMutate("/api/futures/state?account=real"),
      ])
      onDone()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  if (authenticated === false) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-term-line bg-term-panel p-4">
        <p className="text-sm text-term-muted">Entre na sua conta para comprar {ticker}.</p>
        <a
          href="/auth/login"
          className="flex min-h-11 items-center justify-center rounded-md bg-term-up text-sm font-semibold text-background"
        >
          Entrar
        </a>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-term-line bg-term-panel p-4">
      {!isPresale && (
        <div role="radiogroup" aria-label="Operação" className="grid grid-cols-2 gap-1 rounded-md bg-term-line/40 p-1">
          {(["buy", "sell"] as const).map((s) => (
            <button
              key={s}
              role="radio"
              aria-checked={side === s}
              onClick={() => {
                setSide(s)
                setValue("")
              }}
              className={cn(
                "min-h-10 rounded text-sm font-semibold",
                side === s ? (s === "buy" ? "bg-term-up text-background" : "bg-term-down text-background") : "text-term-muted",
              )}
            >
              {s === "buy" ? "Comprar" : "Vender"}
            </button>
          ))}
        </div>
      )}

      {balance != null && side === "buy" && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-term-muted">Saldo real disponível</span>
          <span className="font-mono tabular-nums">US$ {fmtUsd(balance)}</span>
        </div>
      )}
      {side === "sell" && holding && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-term-muted">Disponível para vender</span>
          <span className="font-mono tabular-nums">
            {holding.qty.toLocaleString("pt-BR", { maximumFractionDigits: 6 })} {ticker}
          </span>
        </div>
      )}

      <label className="flex flex-col gap-1.5 text-xs text-term-muted">
        {side === "buy" ? "Valor da compra (USD)" : `Quantidade (${ticker})`}
        <input
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing && e.keyCode !== 229) submit()
          }}
          placeholder={side === "buy" ? "500,00" : "0,0"}
          className="h-12 rounded-md border border-term-line bg-term-bg px-3 font-mono text-base text-term-text outline-none focus:border-primary"
        />
      </label>

      {side === "buy" ? (
        <div className="grid grid-cols-4 gap-1.5">
          {QUICK_AMOUNTS.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setValue(String(v))}
              className="min-h-10 rounded-md border border-term-line text-xs font-medium text-term-text hover:border-primary"
            >
              {v >= 1000 ? `${v / 1000}k` : v}
            </button>
          ))}
        </div>
      ) : (
        holding && (
          <button
            type="button"
            onClick={() => setValue(String(holding.qty))}
            className="min-h-10 self-start text-xs font-medium text-primary"
          >
            Vender tudo
          </button>
        )
      )}

      <p className="text-xs text-term-muted">
        {side === "buy"
          ? `Você recebe ≈ ${preview.toLocaleString("pt-BR", { maximumFractionDigits: 6 })} ${ticker}`
          : `Você recebe ≈ US$ ${fmtUsd(preview)}`}
        {" · "}
        {isPresale ? "preço de pré-venda" : "preço"} US$ {fmtUsd(price)}
      </p>

      <button
        onClick={submit}
        disabled={!valid || busy}
        className={cn(
          "min-h-12 rounded-md text-sm font-semibold text-background disabled:opacity-50",
          side === "buy" ? "bg-term-up" : "bg-term-down",
        )}
      >
        {busy
          ? "Processando..."
          : side === "buy"
            ? isPresale
              ? `Comprar ${ticker} na pré-venda`
              : `Comprar ${ticker}`
            : `Vender ${ticker}`}
      </button>
      {isPresale && (
        <p className="text-[11px] leading-relaxed text-term-muted">
          Venda liberada após o lançamento. O valor é debitado do seu saldo real.
        </p>
      )}
    </div>
  )
}
