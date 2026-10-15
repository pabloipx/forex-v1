import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"
import { TradingError } from "@/lib/futures/errors"

export interface UserDevice {
  id: string
  device_name: string | null
  model: string | null
  browser: string | null
  os: string | null
  ip: string | null
  city: string | null
  region: string | null
  country: string | null
  login_count: number
  last_seen: string | null
  created_at: string | null
}

export interface LoginEvent {
  id: string
  device_name: string | null
  model: string | null
  browser: string | null
  os: string | null
  ip: string | null
  city: string | null
  region: string | null
  country: string | null
  created_at: string
}

export interface UserDetail {
  profile: Record<string, string | number | boolean | null>
  balances: { real: number; demo: number }
  stats: {
    deposited: number
    withdrawn: number
    openPositions: number
    closedPositions: number
    realizedPnl: number
    logins: number
  }
  devices: UserDevice[]
  logins: LoginEvent[]
}

const PROFILE_COLS =
  "id, email, full_name, nickname, phone, document_number, birth_date, country, address_line, city, state, postal_code, occupation, trading_experience, kyc_status, is_verified, is_blocked, created_at, last_login_at"

const sum = (rows: { amount?: unknown; realized_pnl?: unknown }[] | null, key: "amount" | "realized_pnl") =>
  (rows ?? []).reduce((s, r) => s + Number(r[key] ?? 0), 0)

export async function getUserDetail(userId: string): Promise<UserDetail> {
  const db = createAdminClient()
  const [profile, balances, deposits, withdrawals, openPos, closedPos, devices, logins, loginCount] = await Promise.all([
    db.from("profiles").select(PROFILE_COLS).eq("id", userId).maybeSingle(),
    db.from("user_balances").select("balance_real, balance_demo").eq("user_id", userId).maybeSingle(),
    db.from("deposits").select("amount").eq("user_id", userId).in("status", ["confirmed", "paid", "approved", "completed"]),
    db.from("withdrawals").select("amount").eq("user_id", userId).in("status", ["paid", "approved", "completed"]),
    db.from("futures_positions").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "open"),
    db.from("futures_positions").select("realized_pnl").eq("user_id", userId).neq("status", "open").eq("is_demo", false).limit(5000),
    db
      .from("login_sessions")
      .select("id, device_name, model, browser, os, ip, city, region, country, login_count, last_seen, created_at")
      .eq("user_id", userId)
      .order("last_seen", { ascending: false })
      .limit(50),
    db
      .from("login_events")
      .select("id, device_name, model, browser, os, ip, city, region, country, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100),
    db.from("login_events").select("id", { count: "exact", head: true }).eq("user_id", userId),
  ])

  if (profile.error) throw new TradingError("Erro ao carregar usuário", 500)
  if (!profile.data) throw new TradingError("Usuário não encontrado", 404)

  const closed = closedPos.data ?? []
  return {
    profile: profile.data as UserDetail["profile"],
    balances: { real: Number(balances.data?.balance_real ?? 0), demo: Number(balances.data?.balance_demo ?? 0) },
    stats: {
      deposited: sum(deposits.data, "amount"),
      withdrawn: sum(withdrawals.data, "amount"),
      openPositions: openPos.count ?? 0,
      closedPositions: closed.length,
      realizedPnl: sum(closed, "realized_pnl"),
      logins: loginCount.count ?? 0,
    },
    devices: (devices.data ?? []) as UserDevice[],
    logins: (logins.data ?? []) as LoginEvent[],
  }
}
