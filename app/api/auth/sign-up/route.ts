import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { email, password, fullName, phone, referralCode, referralSubId } = await request.json()

    if (!email || !password || !fullName) {
      return NextResponse.json({ error: "Campos obrigatórios faltando" }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "A senha deve ter pelo menos 6 caracteres" }, { status: 400 })
    }

    const supabaseAdmin = createAdminClient()

    // Create user with admin API - email_confirm: true skips email verification
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        phone: phone || "",
      },
    })

    if (createError) {
      if (createError.message.includes("already been registered") || createError.message.includes("already exists")) {
        return NextResponse.json({ error: "Este e-mail já está cadastrado" }, { status: 409 })
      }
      console.error("[v0] Admin createUser error:", createError)
      return NextResponse.json({ error: createError.message }, { status: 400 })
    }

    if (!userData.user) {
      return NextResponse.json({ error: "Erro ao criar usuário" }, { status: 500 })
    }

    const userId = userData.user.id

    // Update profile with phone (trigger already created the profile row)
    if (phone) {
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .update({ full_name: fullName, phone })
        .eq("id", userId)

      if (profileError) {
        console.error("[v0] Profile update error:", profileError)
      }
    }

    // Track referral if code was provided
    if (referralCode && referralCode.trim() !== "") {
      const code = referralCode.trim().toUpperCase()

      // Use raw SQL to handle referral tracking atomically - bypasses all RLS
      const { error: rpcError } = await supabaseAdmin.rpc("track_referral", {
        new_user_id: userId,
        ref_code: code,
        sub_id: typeof referralSubId === "string" && referralSubId.trim() !== "" ? referralSubId.trim() : null,
      })

      if (rpcError) {
        console.error("[v0] track_referral RPC error:", rpcError)
      }
    }

    return NextResponse.json({ userId, email }, { status: 200 })
  } catch (error) {
    console.error("[v0] Sign-up API error:", error)
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 })
  }
}
