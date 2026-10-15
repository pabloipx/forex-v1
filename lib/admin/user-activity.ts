import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"
import { TradingError } from "@/lib/futures/errors"

export const ACTIVITY_KINDS = ["order", "position", "deposit", "withdrawal", "transfer", "adjustment", "kyc", "audit"] as const
export type ActivityKind = (typeof ACTIVITY_KINDS)[number]

export interface ActivityEvent {
  id: string
  kind: ActivityKind
  at: string
  title: string
  detail: string | null
  status: string | null
  amount: number | null
  account: "real" | "demo" | null
}

export interface ActivityPage {
  events: ActivityEvent[]
  nextCursor: string | null
}

type Row = Record<string, unknown>
const num = (v: unknown) => (v == null ? null : Number(v))
const acct = (isDemo: unknown) => (isDemo == null ? null : isDemo ? "demo" : "real") as ActivityEvent["account"]
const side = (s: unknown) => (s === "long" || s === "buy" ? "Compra" : "Venda")

interface Source {
  kind: ActivityKind
  table: string
  columns: string
  timeColumn: string
  userColumn: string
  map: (r: Row) => ActivityEvent
}

const SOURCES: Source[] = [
  {
    kind: "order",
    table: "futures_orders",
    columns: "id, symbol, side, order_type, qty, price, leverage, status, reject_reason, is_demo, created_at",
    timeColumn: "created_at",
    userColumn: "user_id",
    map: (r) => ({
      id: `order-${r.id}`,
      kind: "order",
      at: r.created_at as string,
      title: `Ordem ${String(r.order_type)} · ${side(r.side)} ${r.symbol}`,
      detail: `Qtd ${r.qty} · ${r.leverage}x${r.price ? ` · preço ${r.price}` : ""}${r.reject_reason ? ` · ${r.reject_reason}` : ""}`,
      status: r.status as string,
      amount: null,
      account: acct(r.is_demo),
    }),
  },
  {
    kind: "position",
    table: "futures_positions",
    columns: "id, symbol, side, qty, entry_price, exit_price, leverage, realized_pnl, close_reason, status, is_demo, opened_at",
    timeColumn: "opened_at",
    userColumn: "user_id",
    map: (r) => ({
      id: `position-${r.id}`,
      kind: "position",
      at: r.opened_at as string,
      title: `Posição ${side(r.side)} ${r.symbol} · ${r.leverage}x`,
      detail: `Entrada ${r.entry_price}${r.exit_price ? ` · saída ${r.exit_price}` : ""} · qtd ${r.qty}${r.close_reason ? ` · ${r.close_reason}` : ""}`,
      status: r.status as string,
      amount: r.status === "open" ? null : num(r.realized_pnl),
      account: acct(r.is_demo),
    }),
  },
  {
    kind: "deposit",
    table: "deposits",
    columns: "id, account_type, amount, currency, method, status, created_at",
    timeColumn: "created_at",
    userColumn: "user_id",
    map: (r) => ({
      id: `deposit-${r.id}`,
      kind: "deposit",
      at: r.created_at as string,
      title: `Depósito via ${r.method ?? "—"}`,
      detail: `${r.currency ?? "USDT"}`,
      status: r.status as string,
      amount: num(r.amount),
      account: r.account_type === "demo" ? "demo" : "real",
    }),
  },
  {
    kind: "withdrawal",
    table: "withdrawals",
    columns: "id, amount, currency, method, destination, status, rejection_reason, created_at",
    timeColumn: "created_at",
    userColumn: "user_id",
    map: (r) => ({
      id: `withdrawal-${r.id}`,
      kind: "withdrawal",
      at: r.created_at as string,
      title: `Saque via ${r.method ?? "—"}`,
      detail: `${r.destination ?? ""}${r.rejection_reason ? ` · ${r.rejection_reason}` : ""}` || null,
      status: r.status as string,
      amount: num(r.amount) == null ? null : -Number(r.amount),
      account: "real",
    }),
  },
  {
    kind: "transfer",
    table: "futures_transfers",
    columns: "id, direction, amount, created_at",
    timeColumn: "created_at",
    userColumn: "user_id",
    map: (r) => ({
      id: `transfer-${r.id}`,
      kind: "transfer",
      at: r.created_at as string,
      title: `Transferência ${r.direction === "in" || r.direction === "to_futures" ? "para futuros" : "da conta de futuros"}`,
      detail: String(r.direction ?? ""),
      status: null,
      amount: num(r.amount),
      account: null,
    }),
  },
  {
    kind: "adjustment",
    table: "balance_adjustments",
    columns: "id, is_demo, amount, balance_after, note, created_at",
    timeColumn: "created_at",
    userColumn: "user_id",
    map: (r) => ({
      id: `adjustment-${r.id}`,
      kind: "adjustment",
      at: r.created_at as string,
      title: "Ajuste de saldo pelo admin",
      detail: `${r.note ? `${r.note} · ` : ""}saldo após ${r.balance_after}`,
      status: null,
      amount: num(r.amount),
      account: acct(r.is_demo),
    }),
  },
  {
    kind: "kyc",
    table: "kyc_submissions",
    columns: "id, status, document_type, review_notes, created_at",
    timeColumn: "created_at",
    userColumn: "user_id",
    map: (r) => ({
      id: `kyc-${r.id}`,
      kind: "kyc",
      at: r.created_at as string,
      title: `Envio de KYC${r.document_type ? ` · ${r.document_type}` : ""}`,
      detail: (r.review_notes as string) ?? null,
      status: r.status as string,
      amount: null,
      account: null,
    }),
  },
  {
    kind: "audit",
    table: "audit_logs",
    columns: "id, action, target_type, metadata, ip, created_at",
    timeColumn: "created_at",
    userColumn: "target_id",
    map: (r) => ({
      id: `audit-${r.id}`,
      kind: "audit",
      at: r.created_at as string,
      title: String(r.action).replaceAll("_", " "),
      detail: [r.ip ? `IP ${r.ip}` : null, r.metadata ? JSON.stringify(r.metadata).slice(0, 160) : null].filter(Boolean).join(" · ") || null,
      status: null,
      amount: null,
      account: null,
    }),
  },
]

export async function getUserActivity(
  userId: string,
  opts: { before?: string | null; kinds?: ActivityKind[]; limit?: number } = {},
): Promise<ActivityPage> {
  const limit = Math.min(Math.max(opts.limit ?? 50, 10), 200)
  const kinds = opts.kinds?.length ? new Set(opts.kinds) : null
  const sources = SOURCES.filter((s) => !kinds || kinds.has(s.kind))
  const client = createAdminClient()

  // Each source fetches at most `limit` rows via its (user, time desc) index; merging and
  // slicing afterwards guarantees the page is the true newest `limit` events across tables.
  const results = await Promise.all(
    sources.map(async (s) => {
      let q = client.from(s.table).select(s.columns).eq(s.userColumn, userId).order(s.timeColumn, { ascending: false }).limit(limit)
      if (opts.before) q = q.lt(s.timeColumn, opts.before)
      const { data, error } = await q
      if (error) return [] as ActivityEvent[]
      return ((data ?? []) as unknown as Row[]).filter((r) => r[s.timeColumn]).map(s.map)
    }),
  ).catch(() => {
    throw new TradingError("Não foi possível carregar os logs", 500)
  })

  const merged = results.flat().sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
  const events = merged.slice(0, limit)
  const nextCursor = merged.length > limit ? events[events.length - 1].at : null
  return { events, nextCursor }
}
