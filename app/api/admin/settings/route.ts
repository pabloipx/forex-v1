import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isAdminRequest } from "@/lib/admin/session"


async function verifyAdminToken(): Promise<boolean> {
  return isAdminRequest()
}

export async function GET(request: Request) {
  try {
    if (!(await verifyAdminToken())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const adminClient = createAdminClient()
    const { data: settings, error } = await adminClient.from("platform_settings").select("*")
    if (error) throw error

    const settingsObj: Record<string, string> = {}
    for (const s of settings || []) {
      settingsObj[s.setting_key] = s.setting_value
    }

    return NextResponse.json(settingsObj)
  } catch (error) {
    console.error("Error fetching settings:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

async function upsertSetting(adminClient: any, key: string, value: string) {
  const { error: updateError, count } = await adminClient
    .from("platform_settings")
    .update({ setting_value: value, updated_at: new Date().toISOString() })
    .eq("setting_key", key)
    .select()

  if (updateError || count === 0) {
    await adminClient
      .from("platform_settings")
      .insert({ setting_key: key, setting_value: value })
  }
}

export async function POST(request: Request) {
  try {
    if (!(await verifyAdminToken())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const adminClient = createAdminClient()
    const body = await request.json()

    if (body.card_deposit_enabled !== undefined) {
      await upsertSetting(adminClient, "card_deposit_enabled", String(body.card_deposit_enabled))
    }

    if (body.crypto_deposit_enabled !== undefined) {
      await upsertSetting(adminClient, "crypto_deposit_enabled", String(body.crypto_deposit_enabled))
    }

    if (body.deposit_rollover_enabled !== undefined) {
      await upsertSetting(adminClient, "deposit_rollover_enabled", String(body.deposit_rollover_enabled))
    }

    // Multiplicador do rollover de deposito: aceita fracionado (ex.: 1.5x) e e limitado a um teto
    // para nao travar o saldo do usuario para sempre por um erro de digitacao.
    if (body.deposit_rollover_multiplier !== undefined) {
      const multiplier = Number(body.deposit_rollover_multiplier)
      if (!Number.isFinite(multiplier) || multiplier <= 0 || multiplier > 100) {
        return NextResponse.json(
          { error: "O multiplicador de rollover deve ser um numero entre 0,1 e 100." },
          { status: 400 },
        )
      }
      await upsertSetting(adminClient, "deposit_rollover_multiplier", String(Math.round(multiplier * 100) / 100))
    }

    // Deposito minimo/maximo em dolar (o saldo da corretora e em USD; o PIX converte na hora).
    const minUsd = body.deposit_min_usd !== undefined ? Number(body.deposit_min_usd) : undefined
    const maxUsd = body.deposit_max_usd !== undefined ? Number(body.deposit_max_usd) : undefined
    if (minUsd !== undefined && (!Number.isFinite(minUsd) || minUsd < 1 || minUsd > 100000)) {
      return NextResponse.json({ error: "O deposito minimo deve ficar entre US$ 1 e US$ 100.000." }, { status: 400 })
    }
    if (maxUsd !== undefined && (!Number.isFinite(maxUsd) || maxUsd < 1 || maxUsd > 1000000)) {
      return NextResponse.json({ error: "O deposito maximo deve ficar entre US$ 1 e US$ 1.000.000." }, { status: 400 })
    }
    if (minUsd !== undefined && maxUsd !== undefined && minUsd > maxUsd) {
      return NextResponse.json({ error: "O deposito minimo nao pode ser maior que o maximo." }, { status: 400 })
    }
    if (minUsd !== undefined) await upsertSetting(adminClient, "deposit_min_usd", String(Math.round(minUsd * 100) / 100))
    if (maxUsd !== undefined) await upsertSetting(adminClient, "deposit_max_usd", String(Math.round(maxUsd * 100) / 100))

    if (body.pix_fx_spread_percent !== undefined) {
      const spread = Number(body.pix_fx_spread_percent)
      if (!Number.isFinite(spread) || spread < 0 || spread > 20) {
        return NextResponse.json({ error: "O spread cambial deve ficar entre 0% e 20%." }, { status: 400 })
      }
      await upsertSetting(adminClient, "pix_fx_spread_percent", String(Math.round(spread * 100) / 100))
    }

    // Prazo de processamento de saque, apenas informativo para o usuario.
    if (body.withdrawal_processing_hours !== undefined) {
      const hours = Number(body.withdrawal_processing_hours)
      if (!Number.isInteger(hours) || hours <= 0 || hours > 720) {
        return NextResponse.json(
          { error: "O prazo de saque deve ser um numero inteiro de horas entre 1 e 720." },
          { status: 400 },
        )
      }
      await upsertSetting(adminClient, "withdrawal_processing_hours", String(hours))
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating settings:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  return POST(request)
}
