import { createClient, createAdminClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"
import { getAffiliateSettings, round2 } from "@/lib/affiliate-commission"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })
    }

    const { amount, pixKey, pixKeyType } = await request.json()

    if (!pixKey || !pixKeyType) {
      return NextResponse.json({ error: "Chave PIX e obrigatoria" }, { status: 400 })
    }

    const admin = createAdminClient()
    const settings = await getAffiliateSettings(admin)

    if (!Number.isFinite(Number(amount)) || Number(amount) < settings.min_withdrawal) {
      return NextResponse.json(
        { error: `Valor minimo para saque e R$ ${settings.min_withdrawal.toFixed(2)}` },
        { status: 400 },
      )
    }

    // Buscar dados do perfil/afiliado via admin
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle()

    if (profileError || !profile) {
      return NextResponse.json({ error: "Perfil nao encontrado" }, { status: 404 })
    }

    if (!profile.is_affiliate) {
      return NextResponse.json({ error: "Voce nao e um afiliado" }, { status: 400 })
    }

    const currentBalance = profile.affiliate_balance || 0

    if (currentBalance < amount) {
      return NextResponse.json({ error: "Saldo insuficiente" }, { status: 400 })
    }

    // Taxa de saque definida nas configuracoes do programa
    const fee = round2(amount * (settings.withdrawal_fee_percent / 100))
    const netAmount = round2(amount - fee)

    // Criar solicitacao de saque via admin
    const { data: withdrawal, error: withdrawalError } = await admin
      .from("affiliate_withdrawals")
      .insert({
        affiliate_id: user.id,
        amount,
        fee,
        net_amount: netAmount,
        pix_key: pixKey,
        pix_key_type: pixKeyType,
        status: "pending",
      })
      .select()
      .single()

    if (withdrawalError) throw withdrawalError

    // Atualizar saldo do afiliado (reservar o valor)
    const { error: updateError } = await admin
      .from("profiles")
      .update({
        affiliate_balance: currentBalance - amount,
      })
      .eq("id", user.id)

    if (updateError) throw updateError

    return NextResponse.json({ withdrawal })
  } catch (error) {
    console.error("Erro ao criar saque:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
