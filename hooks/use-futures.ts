"use client"

import useSWR from "swr"
import type { Ticker } from "@/lib/futures/prices"
import type { DerivativesInfo } from "@/lib/futures/derivatives"
import type { AccountMode, FuturesState, PlaceOrderInput } from "@/lib/futures/types"

export type { Ticker, DerivativesInfo }

const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: "no-store" })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

type TickersResponse = { tickers: Record<string, Ticker>; derivatives?: Record<string, DerivativesInfo> }

function useTickersResponse() {
  const { data } = useSWR<TickersResponse>("/api/futures/tickers", fetcher, {
    refreshInterval: 2000,
    keepPreviousData: true,
  })
  return data
}

export function useTickers() {
  return useTickersResponse()?.tickers ?? EMPTY_TICKERS
}

export function useDerivatives() {
  return useTickersResponse()?.derivatives ?? EMPTY_DERIVS
}

const EMPTY_TICKERS: Record<string, Ticker> = {}
const EMPTY_DERIVS: Record<string, DerivativesInfo> = {}

export function useFuturesState(account: AccountMode) {
  const { data, error, isLoading, mutate } = useSWR<FuturesState & { error?: string }>(
    `/api/futures/state?account=${account}`,
    fetcher,
    { refreshInterval: 2000, keepPreviousData: true },
  )
  return { state: data, error, isLoading, refresh: mutate }
}

export interface ClientTradingPrefs {
  defaultLeverage: number
  defaultMarginMode: "cross" | "isolated"
  confirmOrders: boolean
  defaultAccount: "real" | "demo"
}

export function useTradingPrefs(enabled: boolean) {
  const { data } = useSWR<{ profile?: { preferences: ClientTradingPrefs } }>(enabled ? "/api/futures/profile" : null, fetcher, {
    revalidateOnFocus: false,
  })
  return data?.profile?.preferences ?? null
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
  setLeverage: (positionId: string, leverage: number) =>
    send("/api/futures/positions/leverage", "POST", { positionId, leverage }),
  setTrailing: (positionId: string, distance: number | null) =>
    send("/api/futures/positions/trailing", "POST", { positionId, distance }),
  closeAll: (account: AccountMode) => send("/api/futures/positions/close-all", "POST", { account }),
  transfer: (direction: "spot_to_futures" | "futures_to_spot", amount: number) =>
    send("/api/futures/transfer", "POST", { direction, amount }),
}
