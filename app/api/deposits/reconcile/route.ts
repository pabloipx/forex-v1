import { type NextRequest, NextResponse } from "next/server"
import { amplopay } from "@/lib/amplopay"
import { createAdminClient } from "@/lib/supabase/admin"
import { reconcilePendingDeposits } from "@/lib/deposits"

// Sempre dinamico - nunca cacheado
export const dynamic = "force-dynamic"
export const maxDuration = 60

/**
 * Reconciliacao sob demanda dos depositos PIX pendentes DO PROPRIO usuario logado.
 *
 * Chamado pelo cliente quando ele esta ativo no app (foco/visibilidade da aba nas telas de
 * deposito e trade). Cobre o caso real em que o cliente paga no app do banco e volta para o
 * navegador: o deposito e creditado em segundos, sem depender do webhook chegar na hora, sem o
 * cliente precisar manter a tela do PIX aberta e sem esperar o cron diario (o plano Hobby so
 * permite 1 execucao de cron por dia).
 *
 * E escopado ao usuario autenticado — nunca reconcilia depositos de terceiros.
 */
export async function POST(_request: NextRequest) {
  try {
    const { createClient } = await import("@/lib/supabase/server")
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Nao autenticado" }, { status: 401 })
    }

    const supabaseAdmin = createAdminClient()

    const { checked, approved } = await reconcilePendingDeposits(supabaseAdmin, amplopay, {
      userId: user.id,
      limit: 10,
    })

    return NextResponse.json({ success: true, checked, approved })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
