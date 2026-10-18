import { NextResponse } from "next/server"
import { isAdminRequest } from "@/lib/admin/session"
import { createAdminClient } from "@/lib/supabase/admin"
import { pingSuitpay } from "@/lib/suitpay"

export const dynamic = "force-dynamic"

const RECENT_PIX_MS = 15 * 60 * 1000

async function getLastPixAt(): Promise<string | null> {
  try {
    const { data } = await createAdminClient()
      .from("deposits")
      .select("created_at")
      .eq("method", "pix")
      .not("external_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    return data?.created_at ?? null
  } catch {
    return null
  }
}

export async function GET() {
  if (!(await isAdminRequest())) return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  const [health, lastPixAt] = await Promise.all([pingSuitpay(), getLastPixAt()])

  // Um PIX gerado com sucesso há pouco tempo é prova direta de que a API está funcionando.
  if (health.status === "offline" && lastPixAt && Date.now() - new Date(lastPixAt).getTime() < RECENT_PIX_MS) {
    health.status = "online"
    health.message = "PIX gerado com sucesso nos últimos 15 min"
  }

  return NextResponse.json({ health, lastPixAt, serverTime: new Date().toISOString() })
}
