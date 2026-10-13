"use client"

import useSWR, { mutate } from "swr"

export type AdminView = "overview" | "positions" | "orders" | "users" | "markets" | "kyc" | "adjustments"

class AdminFetchError extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}

const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: "no-store" })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new AdminFetchError(json.error ?? "Erro ao carregar", res.status)
  return json.data
}

export function useAdminView<T>(view: AdminView, refreshMs = 0) {
  return useSWR<T>(`/api/admin/forex?view=${view}`, fetcher, {
    refreshInterval: refreshMs,
    revalidateOnFocus: true,
    keepPreviousData: true,
  })
}

export async function adminAction<T = Record<string, unknown>>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch("/api/admin/forex", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error ?? "Falha na operação")
  return json as T
}

export function refreshAdmin(...views: AdminView[]) {
  return Promise.all(views.map((v) => mutate(`/api/admin/forex?view=${v}`)))
}

export const usd = (v: number | null | undefined, d = 2) =>
  v == null || !Number.isFinite(v)
    ? "—"
    : v.toLocaleString("pt-BR", { minimumFractionDigits: d, maximumFractionDigits: d })

export const signedUsd = (v: number) => `${v >= 0 ? "+" : ""}${usd(v)}`

export const dateTime = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—"
