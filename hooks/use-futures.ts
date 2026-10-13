"use client"

import useSWR from "swr"
import type { Ticker } from "@/lib/futures/prices"
import type { AccountMode, FuturesState, PlaceOrderInput } from "@/lib/futures/types"

export type { Ticker }

const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: "no-store" })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export function useTickers() {
  const { data } = useSWR<{ tickers: Record<string, Ticker> }>("/api/futures/tickers", fetcher, {
    refreshInterval: 2000,
    keepPreviousData: true,
  })
  return data?.tickers ?? {}
}

export function useFuturesState(account: AccountMode) {
  const { data, error, isLoading, mutate } = useSWR<FuturesState & { error?: string }>(
    `/api/futures/state?account=${account}`,
    fetcher,
    { refreshInterval: 2000, keepPreviousData: true },
  )
  return { state: data, error, isLoading, refresh: mutate }
}

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error ?? "Falha na operação")
  return json
}

export const futuresApi = {
  placeOrder: (input: PlaceOrderInput) => send("/api/futures/orders", "POST", input),
  cancelOrder: (id: string) => send(`/api/futures/orders?id=${id}`, "DELETE"),
  cancelAll: (account: AccountMode, symbol?: string) =>
    send(`/api/futures/orders?account=${account}${symbol ? `&symbol=${symbol}` : ""}`, "DELETE"),
  closePosition: (positionId: string, qty?: number, price?: number) =>
    send("/api/futures/positions/close", "POST", { positionId, qty: qty ?? null, price: price ?? null }),
  setTpSl: (positionId: string, takeProfit: number | null, stopLoss: number | null) =>
    send("/api/futures/positions/tpsl", "POST", { positionId, takeProfit, stopLoss }),
}
