"use client"

import { useEffect, useRef } from "react"
import { toast } from "sonner"
import type { FuturesState, Position } from "@/lib/futures/types"
import type { DerivativesInfo } from "@/lib/futures/derivatives"

const CLOSE_MESSAGES: Record<string, { title: string; kind: "success" | "error" | "warning" }> = {
  take_profit: { title: "Take Profit acionado", kind: "success" },
  stop_loss: { title: "Stop Loss acionado", kind: "warning" },
  trailing_stop: { title: "Trailing stop acionado", kind: "warning" },
  liquidation: { title: "Posição liquidada", kind: "error" },
}

const NEAR_LIQ = 0.02
const NEAR_LIQ_RESET = 0.04

function notify(kind: "success" | "error" | "warning" | "info", title: string, description: string) {
  toast[kind](title, { description })
  if (typeof document !== "undefined" && document.hidden && "Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body: description })
  }
}

/** Compara o estado entre atualizações e avisa sobre execuções, cancelamentos, TP/SL e risco de liquidação. */
export function useTradeNotifications(state: FuturesState | undefined, derivs: Record<string, DerivativesInfo>) {
  const prevRef = useRef<{ account: string; state: FuturesState } | null>(null)
  const warnedRef = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!state?.authenticated) return
    const prev = prevRef.current
    prevRef.current = { account: state.account, state }
    if (!prev || prev.account !== state.account) return

    const openIds = new Set(state.openOrders.map((o) => o.id))
    for (const o of prev.state.openOrders) {
      if (openIds.has(o.id)) continue
      const done = state.orderHistory.find((h) => h.id === o.id)
      if (!done) continue
      const label = `${o.side === "buy" ? "Compra" : "Venda"} ${done.filled_qty || o.qty} ${o.symbol}`
      if (done.status === "filled") notify("success", "Ordem executada", `${label} a ${done.filled_price ?? o.price}`)
      else if (done.status === "cancelled") notify("info", "Ordem cancelada", label)
      else if (done.status === "rejected") notify("error", "Ordem rejeitada", done.reject_reason ?? label)
    }

    const posIds = new Set(state.positions.map((p) => p.id))
    for (const p of prev.state.positions) {
      if (posIds.has(p.id)) continue
      const closed = state.closedPositions.find((c) => c.id === p.id)
      const msg = closed?.close_reason ? CLOSE_MESSAGES[closed.close_reason] : null
      if (!closed || !msg) continue
      const pnl = closed.realized_pnl
      notify(msg.kind, msg.title, `${p.symbol} ${p.side === "long" ? "Long" : "Short"} · P&L ${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)} USD`)
    }
  }, [state])

  useEffect(() => {
    if (!state?.authenticated) return
    const check = (p: Position) => {
      const mark = derivs[p.symbol]?.markPrice
      if (!mark || !p.liquidation_price) return
      const distance = Math.abs(mark - p.liquidation_price) / mark
      const warned = warnedRef.current
      if (distance < NEAR_LIQ && !warned.has(p.id)) {
        warned.add(p.id)
        notify(
          "warning",
          "Liquidação próxima",
          `${p.symbol} está a ${(distance * 100).toFixed(2)}% do preço de liquidação (${p.liquidation_price}). Adicione margem ou reduza a posição.`,
        )
      } else if (distance > NEAR_LIQ_RESET) {
        warned.delete(p.id)
      }
    }
    state.positions.forEach(check)
  }, [state, derivs])
}
