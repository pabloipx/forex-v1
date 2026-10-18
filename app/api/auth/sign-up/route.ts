import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"
import { PHONE_RULES, isCountryCode, normalizeName, validateSignupProfile } from "@/lib/signup-validation"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password, referralCode, referralSubId } = body
    const firstName = typeof body.firstName === "string" ? body.firstName : ""
    const lastName = typeof body.lastName === "string" ? body.lastName : ""
    const phoneDigits = typeof body.phone === "string" ? body.phone.replace(/\D/g, "") : ""
    const country = body.country

    if (!email || !password || !isCountryCode(country)) {
      return NextResponse.json({ error: "Campos obrigatórios faltando" }, { status: 400 })
    }

    const fieldErrors = validateSignupProfile({ firstName, lastName, country, phone: phoneDigits })
    const firstError = fieldErrors.firstName ?? fieldErrors.lastName ?? fieldErrors.phone
    if (firstError) {
      return NextResponse.json({ error: firstError, fieldErrors }, { status: 400 })
    }

    const fullName = `${normalizeName(firstName)} ${normalizeName(lastName)}`
    const phone = `${PHONE_RULES[country].dial} ${phoneDigits}`

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
