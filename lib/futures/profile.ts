import "server-only"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"
import { createAdminClient } from "@/lib/supabase/admin"
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/supabase/env"
import { TradingError } from "./errors"
import { isTestModeEnabled, TEST_EMAIL, TEST_USER_ID } from "./demo-session"

export interface TradingPrefs {
  defaultLeverage: number
  defaultMarginMode: "cross" | "isolated"
  confirmOrders: boolean
  defaultAccount: "real" | "demo"
}

export interface UserProfileData {
  id: string
  email: string
  full_name: string | null
  nickname: string | null
  phone: string | null
  document_number: string | null
  birth_date: string | null
  country: string | null
  address_line: string | null
  city: string | null
  state: string | null
  postal_code: string | null
  occupation: string | null
  trading_experience: string | null
  kyc_status: string
  is_verified: boolean
  created_at: string | null
  last_login_at: string | null
  preferences: TradingPrefs
  testMode: boolean
}

export const DEFAULT_PREFS: TradingPrefs = {
  defaultLeverage: 10,
  defaultMarginMode: "cross",
  confirmOrders: false,
  defaultAccount: "real",
}

const TEXT_FIELDS = {
  full_name: 120,
  nickname: 40,
  phone: 30,
  document_number: 30,
  country: 2,
  address_line: 200,
  city: 80,
  state: 40,
  postal_code: 15,
  occupation: 80,
} as const

const EXPERIENCE = ["beginner", "intermediate", "advanced", "professional"]

type Patch = Partial<Record<keyof typeof TEXT_FIELDS | "birth_date" | "trading_experience", string | null>> & {
  preferences?: Partial<TradingPrefs>
}

function normalizePrefs(raw: unknown): TradingPrefs {
  const p = (raw && typeof raw === "object" ? raw : {}) as Partial<TradingPrefs>
  return {
    defaultLeverage: Number.isFinite(p.defaultLeverage) ? Math.min(500, Math.max(1, Math.round(p.defaultLeverage!))) : DEFAULT_PREFS.defaultLeverage,
    defaultMarginMode: p.defaultMarginMode === "isolated" ? "isolated" : "cross",
    confirmOrders: typeof p.confirmOrders === "boolean" ? p.confirmOrders : DEFAULT_PREFS.confirmOrders,
    defaultAccount: p.defaultAccount === "demo" ? "demo" : "real",
  }
}

function sanitize(input: Record<string, unknown>): Patch {
  const out: Patch = {}
  for (const [key, max] of Object.entries(TEXT_FIELDS) as [keyof typeof TEXT_FIELDS, number][]) {
    if (!(key in input)) continue
    const v = input[key]
    if (v != null && typeof v !== "string") throw new TradingError(`Campo inválido: ${key}`)
    const s = (v ?? "").trim()
    if (s.length > max) throw new TradingError(`Campo muito longo: ${key}`)
    out[key] = s ? (key === "country" ? s.toUpperCase() : s) : null
  }
  if ("birth_date" in input) {
    const v = input.birth_date
    if (v && (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v)))) {
      throw new TradingError("Data de nascimento inválida")
    }
    if (v) {
      const age = (Date.now() - Date.parse(v as string)) / (365.25 * 86400000)
      if (age < 18) throw new TradingError("É necessário ter 18 anos ou mais")
    }
    out.birth_date = (v as string) || null
  }
  if ("trading_experience" in input) {
    const v = input.trading_experience
    if (typeof v !== "string" || !EXPERIENCE.includes(v)) throw new TradingError("Experiência inválida")
    out.trading_experience = v
  }
  if (input.preferences && typeof input.preferences === "object") {
    out.preferences = input.preferences as Partial<TradingPrefs>
  }
  return out
}

type TestStore = { __fxTestProfile?: Omit<UserProfileData, "testMode"> }

function testProfile() {
  const g = globalThis as TestStore
  g.__fxTestProfile ??= {
    id: TEST_USER_ID,
    email: TEST_EMAIL,
    full_name: "Administrador Teste",
    nickname: "admin",
    phone: null,
    document_number: null,
    birth_date: null,
    country: "BR",
    address_line: null,
    city: null,
    state: null,
    postal_code: null,
    occupation: null,
    trading_experience: "intermediate",
    kyc_status: "approved",
    is_verified: true,
    created_at: new Date().toISOString(),
    last_login_at: new Date().toISOString(),
    preferences: { ...DEFAULT_PREFS },
  }
  return g.__fxTestProfile
}

const COLUMNS =
  "id, email, full_name, nickname, phone, document_number, birth_date, country, address_line, city, state, postal_code, occupation, trading_experience, kyc_status, is_verified, created_at, last_login_at, preferences"

export async function getProfile(user: { id: string; email?: string }): Promise<UserProfileData> {
  if (isTestModeEnabled()) return { ...testProfile(), testMode: true }
  const db = createAdminClient()
  const { data, error } = await db.from("profiles").select(COLUMNS).eq("id", user.id).maybeSingle()
  if (error) throw new TradingError("Não foi possível carregar o perfil", 500)
  const row = (data ?? {}) as Record<string, unknown>
  return {
    ...(row as unknown as UserProfileData),
    id: user.id,
    email: (row.email as string) || user.email || "",
    kyc_status: (row.kyc_status as string) || "pending",
    is_verified: !!row.is_verified,
    preferences: normalizePrefs(row.preferences),
    testMode: false,
  }
}

export async function updateProfile(user: { id: string; email?: string }, input: Record<string, unknown>) {
  const patch = sanitize(input)
  const current = await getProfile(user)
  const preferences = patch.preferences ? normalizePrefs({ ...current.preferences, ...patch.preferences }) : undefined

  if (isTestModeEnabled()) {
    const p = testProfile()
    Object.assign(p, patch, preferences ? { preferences } : {})
    return { ...p, testMode: true }
  }
  const { preferences: _ignored, ...fields } = patch
  const db = createAdminClient()
  const { error } = await db
    .from("profiles")
    .upsert({ id: user.id, email: current.email, ...fields, ...(preferences ? { preferences } : {}), updated_at: new Date().toISOString() })
  if (error) throw new TradingError("Não foi possível salvar o perfil", 500)
  return getProfile(user)
}

export async function changePassword(user: { id: string; email?: string }, currentPassword: string, newPassword: string) {
  if (isTestModeEnabled()) throw new TradingError("Troca de senha indisponível no modo teste (sem banco de dados)")
  if (newPassword.length < 8 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
    throw new TradingError("A nova senha precisa de 8+ caracteres, com letras e números")
  }
  if (!user.email) throw new TradingError("Conta sem e-mail")
  const verifier = createSupabaseClient(getSupabaseUrl(), getSupabasePublishableKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error: signInError } = await verifier.auth.signInWithPassword({ email: user.email, password: currentPassword })
  if (signInError) throw new TradingError("Senha atual incorreta", 400)
  const { error } = await createAdminClient().auth.admin.updateUserById(user.id, { password: newPassword })
  if (error) throw new TradingError("Não foi possível alterar a senha", 500)
}
