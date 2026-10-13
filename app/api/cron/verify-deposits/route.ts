import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { amplopay } from "@/lib/amplopay"
import { reconcilePendingDeposits } from "@/lib/deposits"

// Sempre dinamico - nunca cacheado
export const dynamic = "force-dynamic"
export const maxDuration = 60

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  const key = process.env.SUPABASE_SECRET_KEY || ""
  return createClient(url, key)
}

/**
 * Verificacao automatica de depositos pendentes (cron).
 *
 * Consulta o status de cada deposito PIX pendente diretamente na AmploPay e, se estiver pago,
 * credita o saldo — sem depender do webhook nem do app do cliente estar aberto.
 *
 * ATENCAO: este cron e apenas a ULTIMA rede de seguranca, nao o caminho principal. O comentario
 * anterior dizia "roda a cada minuto", o que nunca foi verdade: o vercel.json agenda "0 3 * * *"
 * (uma vez por dia, as 03:00) e o projeto esta no plano Hobby, que permite apenas 1 execucao
 * diaria de cron. Quem credita o deposito em segundos e o webhook da AmploPay
 * (/api/webhook/amplopay); a verificacao ativa no polling de /api/pix cobre o caso do cliente
 * com a tela do PIX aberta. Se o credito automatico voltar a falhar, investigue o webhook
 * primeiro - nao conte com este cron para resolver em minutos.
 */
async function handler(request: NextRequest) {
  // Seguranca: se CRON_SECRET estiver configurado, exige o header Authorization da Vercel.
  // Requisicoes de cron da Vercel chegam com "Authorization: Bearer <CRON_SECRET>".
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get("authorization")
    const isVercelCron = request.headers.get("x-vercel-cron") !== null
    if (!isVercelCron && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })
    }
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 })
  }

  const supabaseAdmin = getSupabaseAdmin()

  try {
    const { checked, approved } = await reconcilePendingDeposits(supabaseAdmin, amplopay, { limit: 50 })
    return NextResponse.json({ success: true, checked, approved })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro ao reconciliar depositos"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return handler(request)
}

export async function POST(request: NextRequest) {
  return handler(request)
}
