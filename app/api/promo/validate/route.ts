import { type NextRequest, NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { validatePromoCode } from "@/lib/promo-codes"

/**
 * Valida um codigo promocional e devolve o bonus previsto, para a tela de deposito mostrar antes
 * de gerar o PIX.
 *
 * Esta rota e apenas uma PREVIA. O bonus que vale e recalculado no servidor na hora de gerar o PIX
 * e novamente na aprovacao do deposito, entao nada que venha da tela pode inflar o valor.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Nao autenticado" }, { status: 401 })
    }

    const body = await request.json()
    const { code, amount } = body

    const numericAmount =
      typeof amount === "string"
        ? Number.parseFloat(amount.replace(/[^\d.,]/g, "").replace(",", "."))
        : Number(amount)

    if (isNaN(numericAmount) || numericAmount <= 0) {
      return NextResponse.json({ valid: false, error: "Informe o valor do depósito primeiro." })
    }

    // Cliente admin porque promo_codes tem RLS sem politica de leitura publica: os detalhes da
    // campanha (limites, multiplicador) nao devem ficar acessiveis direto do navegador.
    const supabaseAdmin = createAdminClient()
    const validation = await validatePromoCode(supabaseAdmin, String(code || ""), user.id, numericAmount)

    if (!validation.valid) {
      return NextResponse.json({ valid: false, error: validation.error })
    }

    return NextResponse.json({
      valid: true,
      code: validation.promo.code,
      description: validation.promo.description,
      bonusAmount: validation.bonusAmount,
      rolloverRequired: validation.rolloverRequired,
      totalCredit: Math.round((numericAmount + validation.bonusAmount) * 100) / 100,
    })
  } catch (error: any) {
    console.error("[v0] Erro ao validar codigo promocional:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
