import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

// POST - Registrar referido após cadastro
export async function POST(request: Request) {
  try {
    const supabase = createAdminClient()
    const { referralCode, userId } = await request.json()

    if (!referralCode || !userId) {
      return NextResponse.json({ error: "Dados invalidos" }, { status: 400 })
    }

    // Use the atomic track_referral RPC
    const { error } = await supabase.rpc("track_referral", {
      new_user_id: userId,
      ref_code: referralCode.trim().toUpperCase(),
    })

    if (error) {
      console.error("[v0] track_referral RPC error:", error)
      return NextResponse.json({ error: "Erro ao rastrear referido" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Erro ao registrar referido:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
