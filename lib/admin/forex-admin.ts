import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"
import { TradingError } from "@/lib/futures/errors"
import { TEST_EMAIL, TEST_USER_ID, isTestModeEnabled } from "@/lib/futures/demo-session"
import { MARKETS, getMarket, notionalUsd, unrealizedPnl } from "@/lib/futures/markets"
import { getAllTickers } from "@/lib/futures/prices"
import { ensureMarketSettings, saveMarketParams, type MarketParams } from "@/lib/futures/market-settings"
import * as demo from "@/lib/futures/demo-engine"
import * as engine from "@/lib/futures/engine"
import type { Order, Position } from "@/lib/futures/types"

export interface AdminPosition extends Position {
  user_id: string
  email: string
  mark: number | null
  upnl: number
  notional: number
}

export interface AdminOrder extends Order {
  user_id: string
  email: string
  is_demo: boolean
}

export interface AdminUser {
  id: string
  email: string
  full_name: string | null
  phone: string | null
  country: string | null
  kyc_status: string
  is_blocked: boolean
  balance_real: number
  balance_demo: number
  open_positions: number
  realized_pnl: number
  created_at: string | null
  last_login_at: string | null
}

export interface AdminKyc {
  id: string
  user_id: string
  email: string
  document_type: string | null
  status: string
  review_notes: string | null
  created_at: string
  files: { label: string; path: string | null }[]
}

export interface AdminAdjustment {
  id: string
  email: string
  is_demo: boolean
  amount: number
  balance_after: number
  note: string | null
  created_at: string
}

const g = globalThis as unknown as {
  __fxTestBlocked?: boolean
  __fxTestAdjustments?: AdminAdjustment[]
}

const testMode = () => isTestModeEnabled()
const db = () => createAdminClient()

function withLive(p: Position & { user_id: string; email: string }, tickers: Record<string, { price: number }>): AdminPosition {
  const market = getMarket(p.symbol)
  const mark = tickers[p.symbol]?.price ?? null
  const qty = Number(p.qty)
  const entry = Number(p.entry_price)
  return {
    ...p,
    mark,
    upnl: market && mark ? unrealizedPnl(market, p.side, qty, entry, mark) : 0,
    notional: market ? notionalUsd(market, qty, mark ?? entry) : 0,
  }
}

async function emailMap(ids: string[]): Promise<Record<string, string>> {
  const unique = [...new Set(ids)]
  if (!unique.length) return {}
  const { data } = await db().from("profiles").select("id, email").in("id", unique)
  return Object.fromEntries((data ?? []).map((r) => [r.id as string, (r.email as string) ?? "—"]))
}

// ---------- Posições / ordens ----------

export async function listOpenPositions(): Promise<AdminPosition[]> {
  const tickers = await getAllTickers().catch(() => ({}) as Record<string, { price: number }>)
  if (testMode()) {
    const a = demo.getTestAccounts()
    return [...a.real.positions, ...a.demo.positions].map((p) =>
      withLive({ ...p, user_id: TEST_USER_ID, email: TEST_EMAIL }, tickers),
    )
  }
  const { data, error } = await db()
    .from("futures_positions")
    .select("*")
    .eq("status", "open")
    .order("opened_at", { ascending: false })
    .limit(500)
  if (error) throw new TradingError("Tabelas de futuros ausentes. Rode scripts/setup_completo.sql.", 500)
  const emails = await emailMap((data ?? []).map((r) => r.user_id as string))
  return (data ?? []).map((r) => withLive({ ...(r as Position & { user_id: string }), email: emails[r.user_id] ?? "—" }, tickers))
}

export async function listOpenOrders(): Promise<AdminOrder[]> {
  if (testMode()) {
    const a = demo.getTestAccounts()
    const map = (o: Order, isDemo: boolean): AdminOrder => ({ ...o, user_id: TEST_USER_ID, email: TEST_EMAIL, is_demo: isDemo })
    return [
      ...a.real.orders.filter((o) => o.status === "open").map((o) => map(o, false)),
      ...a.demo.orders.filter((o) => o.status === "open").map((o) => map(o, true)),
    ]
  }
  const { data, error } = await db()
    .from("futures_orders")
    .select("*")
    .eq("status", "open")
    .order("created_at", { ascending: false })
    .limit(500)
  if (error) throw new TradingError("Tabelas de futuros ausentes. Rode scripts/setup_completo.sql.", 500)
  const emails = await emailMap((data ?? []).map((r) => r.user_id as string))
  return (data ?? []).map((r) => ({ ...(r as AdminOrder), email: emails[r.user_id] ?? "—" }))
}

export async function forceClosePosition(userId: string, positionId: string) {
  if (testMode()) return demo.closePosition(positionId)
  return engine.closePosition(userId, positionId)
}

export async function forceCancelOrder(userId: string, orderId: string) {
  if (testMode()) return demo.cancelOrder(orderId, "Cancelada pelo administrador")
  return engine.cancelOrder(userId, orderId, "Cancelada pelo administrador")
}

// ---------- Visão geral ----------

export async function getOverview() {
  const [positions, orders, users, cash, kyc] = await Promise.all([
    listOpenPositions(),
    listOpenOrders(),
    listUsers(),
    getCashflow().catch(() => null),
    listKyc().catch(() => [] as AdminKyc[]),
  ])
  const real = positions.filter((p) => !p.is_demo)

  let closed: Pick<Position, "realized_pnl" | "fees_paid" | "closed_at" | "status">[] = []
  if (testMode()) {
    closed = demo.getTestAccounts().real.closed
  } else {
    const since = new Date(Date.now() - 30 * 86400_000).toISOString()
    const { data } = await db()
      .from("futures_positions")
      .select("realized_pnl, fees_paid, closed_at, status")
      .eq("is_demo", false)
      .neq("status", "open")
      .gte("closed_at", since)
      .limit(5000)
    closed = (data ?? []) as typeof closed
  }

  const dayAgo = Date.now() - 86400_000
  const closed24 = closed.filter((p) => p.closed_at && new Date(p.closed_at).getTime() >= dayAgo)
  const sum = (arr: typeof closed, k: "realized_pnl" | "fees_paid") => arr.reduce((s, p) => s + Number(p[k] ?? 0), 0)

  const exposure = MARKETS.map((m) => {
    const ps = real.filter((p) => p.symbol === m.symbol)
    const long = ps.filter((p) => p.side === "long").reduce((s, p) => s + p.notional, 0)
    const short = ps.filter((p) => p.side === "short").reduce((s, p) => s + p.notional, 0)
    const upnl = ps.reduce((s, p) => s + p.upnl, 0)
    return { symbol: m.symbol, category: m.category, long, short, net: long - short, upnl, count: ps.length }
  }).filter((e) => e.count > 0)

  const clientUpnl = real.reduce((s, p) => s + p.upnl, 0)
  const clientRealized30 = sum(closed, "realized_pnl")
  const fees30 = sum(closed, "fees_paid")

  return {
    mode: testMode() ? "test" : "database",
    users: users.length,
    blockedUsers: users.filter((u) => u.is_blocked).length,
    pendingKyc: kyc.filter((k) => k.status === "pending").length,
    cash,
    totalRealBalance: users.reduce((s, u) => s + u.balance_real, 0),
    openPositions: real.length,
    openOrders: orders.filter((o) => !o.is_demo).length,
    openInterest: real.reduce((s, p) => s + p.notional, 0),
    marginInUse: real.reduce((s, p) => s + Number(p.margin), 0),
    clientUpnl,
    houseUpnl: -clientUpnl,
    clientRealized24: sum(closed24, "realized_pnl"),
    fees24: sum(closed24, "fees_paid"),
    clientRealized30,
    fees30,
    houseResult30: -clientRealized30 + fees30,
    liquidations30: closed.filter((p) => p.status === "liquidated").length,
    exposure,
  }
}

// ---------- Usuários ----------

export async function listUsers(): Promise<AdminUser[]> {
  if (testMode()) {
    const a = demo.getTestAccounts()
    return [
      {
        id: TEST_USER_ID,
        email: TEST_EMAIL,
        full_name: "Conta de teste",
        phone: null,
        country: "BR",
        kyc_status: "approved",
        is_blocked: !!g.__fxTestBlocked,
        balance_real: a.real.balance,
        balance_demo: a.demo.balance,
        open_positions: a.real.positions.length + a.demo.positions.length,
        realized_pnl: a.real.closed.reduce((s, p) => s + Number(p.realized_pnl), 0),
        created_at: null,
        last_login_at: null,
      },
    ]
  }
  const client = db()
  const { data: profiles, error } = await client
    .from("profiles")
    .select("id, email, full_name, phone, country, kyc_status, is_blocked, created_at, last_login_at")
    .order("created_at", { ascending: false })
    .limit(1000)
  if (error) throw new TradingError("Tabela profiles ausente. Rode scripts/setup_completo.sql.", 500)
  const ids = (profiles ?? []).map((p) => p.id as string)
  const [{ data: balances }, { data: open }] = ids.length
    ? await Promise.all([
        client.from("user_balances").select("user_id, balance_real, balance_demo").in("user_id", ids),
        client.from("futures_positions").select("user_id").eq("status", "open").in("user_id", ids),
      ])
    : [{ data: [] }, { data: [] }]
  const bal = Object.fromEntries((balances ?? []).map((b) => [b.user_id as string, b]))
  const openCount: Record<string, number> = {}
  for (const r of open ?? []) openCount[r.user_id as string] = (openCount[r.user_id as string] ?? 0) + 1
  return (profiles ?? []).map((p) => ({
    id: p.id,
    email: p.email ?? "—",
    full_name: p.full_name ?? null,
    phone: p.phone ?? null,
    country: p.country ?? null,
    kyc_status: p.kyc_status ?? "pending",
    is_blocked: !!p.is_blocked,
    balance_real: Number(bal[p.id]?.balance_real ?? 0),
    balance_demo: Number(bal[p.id]?.balance_demo ?? 0),
    open_positions: openCount[p.id] ?? 0,
    realized_pnl: 0,
    created_at: p.created_at ?? null,
    last_login_at: p.last_login_at ?? null,
  }))
}

export function isTestUserBlocked() {
  return !!g.__fxTestBlocked
}

export async function setUserBlocked(userId: string, blocked: boolean) {
  if (testMode()) {
    g.__fxTestBlocked = blocked
    return
  }
  const { error } = await db().from("profiles").update({ is_blocked: blocked }).eq("id", userId)
  if (error) throw new TradingError("Não foi possível atualizar o usuário", 500)
}

export async function adjustBalance(userId: string, isDemo: boolean, amount: number, note: string | null) {
  if (!Number.isFinite(amount) || amount === 0) throw new TradingError("Informe um valor diferente de zero")
  if (Math.abs(amount) > 10_000_000) throw new TradingError("Valor acima do limite permitido")
  if (testMode()) {
    const after = demo.adjustTestBalance(isDemo, amount)
    g.__fxTestAdjustments = [
      { id: crypto.randomUUID(), email: TEST_EMAIL, is_demo: isDemo, amount, balance_after: after, note, created_at: new Date().toISOString() },
      ...(g.__fxTestAdjustments ?? []),
    ].slice(0, 100)
    return after
  }
  const { data, error } = await db().rpc("admin_adjust_balance", {
    p_user: userId,
    p_is_demo: isDemo,
    p_delta: amount,
    p_note: note,
  })
  if (error) throw new TradingError(error.message.includes("negativo") ? "Saldo resultante não pode ser negativo" : "Falha no ajuste. Rode scripts/300_forex_admin.sql.", 400)
  return Number(data)
}

export async function listAdjustments(): Promise<AdminAdjustment[]> {
  if (testMode()) return g.__fxTestAdjustments ?? []
  const { data } = await db().from("balance_adjustments").select("*").order("created_at", { ascending: false }).limit(100)
  const emails = await emailMap((data ?? []).map((r) => r.user_id as string))
  return (data ?? []).map((r) => ({
    id: r.id,
    email: emails[r.user_id] ?? "—",
    is_demo: r.is_demo,
    amount: Number(r.amount),
    balance_after: Number(r.balance_after),
    note: r.note,
    created_at: r.created_at,
  }))
}

// ---------- KYC ----------

export async function listKyc(): Promise<AdminKyc[]> {
  if (testMode()) return []
  const { data, error } = await db()
    .from("kyc_submissions")
    .select("id, user_id, status, document_type, document_front_path, document_back_path, selfie_path, review_notes, created_at")
    .neq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(200)
  if (error) throw new TradingError("Não foi possível carregar o KYC", 500)
  const emails = await emailMap((data ?? []).map((r) => r.user_id as string))
  return (data ?? []).map((r) => ({
    id: r.id,
    user_id: r.user_id,
    email: emails[r.user_id] ?? "—",
    document_type: r.document_type,
    status: r.status ?? "pending",
    review_notes: r.review_notes ?? null,
    created_at: r.created_at,
    files: [
      { label: "Frente", path: r.document_front_path },
      { label: "Verso", path: r.document_back_path },
      { label: "Selfie", path: r.selfie_path },
    ],
  }))
}

export async function reviewKyc(id: string, approve: boolean, reason: string | null) {
  if (testMode()) throw new TradingError("KYC exige o banco de dados configurado")
  if (!approve && !reason?.trim()) throw new TradingError("Informe o motivo da rejeição")
  const client = db()
  const { data: req, error } = await client
    .from("kyc_submissions")
    .update({
      status: approve ? "approved" : "rejected",
      review_notes: approve ? null : reason,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("user_id")
    .single()
  if (error || !req) throw new TradingError("Solicitação não encontrada", 404)
  await client
    .from("profiles")
    .update({ kyc_status: approve ? "approved" : "rejected", is_verified: approve })
    .eq("id", req.user_id)
}

// ---------- Saques ----------

export interface AdminWithdrawal {
  id: string
  user_id: string
  email: string
  full_name: string | null
  amount: number
  currency: string
  method: string
  destination: Record<string, string | null>
  status: string
  rejection_reason: string | null
  created_at: string
  reviewed_at: string | null
  kyc_status: string
}

export async function listWithdrawals(): Promise<AdminWithdrawal[]> {
  if (testMode()) return []
  const client = db()
  const { data, error } = await client
    .from("withdrawals")
    .select("id, user_id, amount, currency, method, destination, status, rejection_reason, created_at, reviewed_at")
    .order("created_at", { ascending: false })
    .limit(300)
  if (error) throw new TradingError("Não foi possível carregar os saques", 500)
  const ids = [...new Set((data ?? []).map((r) => r.user_id as string))]
  const { data: profiles } = ids.length
    ? await client.from("profiles").select("id, email, full_name, kyc_status").in("id", ids)
    : { data: [] }
  const byId = Object.fromEntries((profiles ?? []).map((p) => [p.id as string, p]))
  return (data ?? []).map((r) => ({
    id: r.id,
    user_id: r.user_id,
    email: byId[r.user_id]?.email ?? "—",
    full_name: byId[r.user_id]?.full_name ?? null,
    amount: Number(r.amount),
    currency: r.currency ?? "BRL",
    method: r.method,
    destination: (r.destination ?? {}) as Record<string, string | null>,
    status: r.status ?? "pending",
    rejection_reason: r.rejection_reason ?? null,
    created_at: r.created_at,
    reviewed_at: r.reviewed_at ?? null,
    kyc_status: byId[r.user_id]?.kyc_status ?? "—",
  }))
}

export async function reviewWithdrawal(id: string, status: "approved" | "paid" | "rejected", reason: string | null) {
  if (testMode()) throw new TradingError("Saques exigem o banco de dados configurado")
  if (status === "rejected" && !reason?.trim()) throw new TradingError("Informe o motivo da rejeição")
  const { data, error } = await db().rpc("admin_review_withdrawal", { p_id: id, p_status: status, p_reason: reason })
  if (error) throw new TradingError(error.message, 400)
  return data as string
}

// ---------- Depósitos ----------

export interface AdminDeposit {
  id: string
  user_id: string
  email: string
  account_type: string
  amount: number
  currency: string
  method: string | null
  provider: string | null
  external_id: string | null
  status: string
  created_at: string
  confirmed_at: string | null
  crypto: { currency: string; network: string; amount_usd: number; tx_hash: string } | null
}

export async function listDeposits(): Promise<AdminDeposit[]> {
  if (testMode()) return []
  const { data, error } = await db()
    .from("deposits")
    .select("id, user_id, account_type, amount, currency, method, provider, external_id, status, created_at, confirmed_at, payment_details")
    .order("created_at", { ascending: false })
    .limit(300)
  if (error) throw new TradingError("Não foi possível carregar os depósitos", 500)
  const emails = await emailMap((data ?? []).map((r) => r.user_id as string))
  return (data ?? []).map((r) => ({
    id: r.id,
    user_id: r.user_id,
    email: emails[r.user_id] ?? "—",
    account_type: r.account_type ?? "real",
    amount: Number(r.amount),
    currency: r.currency ?? "BRL",
    method: r.method ?? null,
    provider: r.provider ?? null,
    external_id: r.external_id ?? null,
    status: r.status ?? "pending",
    created_at: r.created_at,
    confirmed_at: r.confirmed_at ?? null,
    crypto: cryptoDetails(r.payment_details),
  }))
}

function cryptoDetails(details: unknown): AdminDeposit["crypto"] {
  if (!details || typeof details !== "object") return null
  const d = details as Record<string, unknown>
  if (d.type !== "crypto") return null
  return {
    currency: String(d.currency ?? "USDT"),
    network: String(d.network ?? ""),
    amount_usd: Number(d.amount_usd ?? 0),
    tx_hash: String(d.tx_hash ?? ""),
  }
}

export async function reviewDeposit(id: string, confirm: boolean) {
  if (testMode()) throw new TradingError("Depósitos exigem o banco de dados configurado")
  const { data, error } = await db().rpc("admin_review_deposit", { p_id: id, p_confirm: confirm })
  if (error) throw new TradingError(error.message, 400)
  return data as string
}

export async function getCashflow() {
  if (testMode()) return { pendingWithdrawals: 0, pendingWithdrawalsAmount: 0, pendingDeposits: 0, deposits24: 0, withdrawalsPaid24: 0 }
  const client = db()
  const since = new Date(Date.now() - 86400_000).toISOString()
  const [{ data: pw }, { count: pd }, { data: d24 }, { data: w24 }] = await Promise.all([
    client.from("withdrawals").select("amount").in("status", ["pending", "approved"]),
    client.from("deposits").select("id", { count: "exact", head: true }).eq("status", "pending"),
    client.from("deposits").select("amount").eq("status", "confirmed").eq("account_type", "real").gte("confirmed_at", since),
    client.from("withdrawals").select("amount").eq("status", "paid").gte("reviewed_at", since),
  ])
  const total = (rows: { amount: unknown }[] | null) => (rows ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0)
  return {
    pendingWithdrawals: pw?.length ?? 0,
    pendingWithdrawalsAmount: total(pw),
    pendingDeposits: pd ?? 0,
    deposits24: total(d24),
    withdrawalsPaid24: total(w24),
  }
}

export async function signKycFile(path: string) {
  if (testMode()) throw new TradingError("Arquivos exigem o banco de dados configurado")
  if (/^https?:\/\//.test(path)) return path
  const { data, error } = await db().storage.from("kyc-documents").createSignedUrl(path, 300)
  if (error || !data) throw new TradingError("Arquivo não encontrado", 404)
  return data.signedUrl
}

// ---------- Mercados ----------

export async function listMarketSettings() {
  const settings = await ensureMarketSettings(true)
  const tickers = await getAllTickers().catch(() => ({}) as Record<string, { price: number; change24h?: number }>)
  return MARKETS.map((m) => ({
    ...settings[m.symbol],
    symbol: m.symbol,
    base: m.base,
    category: m.category,
    source: m.source,
    price: tickers[m.symbol]?.price ?? null,
  }))
}

export function updateMarket(symbol: string, patch: Partial<MarketParams>) {
  return saveMarketParams(symbol, patch)
}
