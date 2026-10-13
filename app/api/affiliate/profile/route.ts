import { createClient, createAdminClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

function splitName(fullName: string | null) {
  const parts = (fullName || "").trim().split(/\s+/).filter(Boolean)
  return {
    first_name: parts[0] || "",
    last_name: parts.slice(1).join(" "),
  }
}

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })
    }

    const admin = createAdminClient()
    const { data: profile } = await admin
      .from("profiles")
      .select("full_name, nickname, country, account_type, birth_date, email")
      .eq("id", user.id)
      .maybeSingle()

    const { first_name, last_name } = splitName(profile?.full_name ?? null)

    return NextResponse.json({
      profile: {
        email: profile?.email || user.email || "",
        email_confirmed: Boolean(user.email_confirmed_at),
        account_type: profile?.account_type || "individual",
        first_name,
        last_name,
        nickname: profile?.nickname || "",
        country: profile?.country || "BR",
        birth_date: profile?.birth_date || "",
      },
    })
  } catch (error) {
    console.error("Erro ao carregar perfil:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })
    }

    const body = await request.json()
    const firstName = String(body.firstName || "").trim()
    const lastName = String(body.lastName || "").trim()
    const nickname = String(body.nickname || "").trim()
    const country = String(body.country || "").trim()
    const birthDate = String(body.birthDate || "").trim()

    if (!firstName || !lastName) {
      return NextResponse.json({ error: "Nome e sobrenome sao obrigatorios" }, { status: 400 })
    }

    if (!nickname || nickname.length < 3) {
      return NextResponse.json({ error: "O apelido deve ter pelo menos 3 caracteres" }, { status: 400 })
    }

    if (!country) {
      return NextResponse.json({ error: "Selecione o pais de residencia" }, { status: 400 })
    }

    const admin = createAdminClient()
    const { error } = await admin
      .from("profiles")
      .update({
        full_name: `${firstName} ${lastName}`,
        nickname,
        country,
        birth_date: birthDate || null,
      })
      .eq("id", user.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Erro ao atualizar perfil:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
