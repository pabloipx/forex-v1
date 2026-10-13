import { createClient, createAdminClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

const ALLOWED = ["usdt", "pix"] as const

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
    const { data, error } = await admin
      .from("affiliate_payment_methods")
      .select("*")
      // A coluna de dono e `affiliate_id`; filtrar por `user_id` (inexistente) fazia o PostgREST
      // devolver erro 42703 e a listagem caia sempre no catch, retornando 500.
      .eq("affiliate_id", user.id)
      .order("created_at", { ascending: true })

    if (error) throw error

    // A tabela guarda em `type`, mas a interface consome `method`: normalizamos aqui para nao
    // espalhar o nome da coluna pelos componentes.
    const methods = (data ?? []).map((row) => ({ ...row, method: row.type }))

    return NextResponse.json({ methods })
  } catch (error) {
    console.error("Erro ao listar metodos de pagamento:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })
    }

    const body = await request.json()
    const method = String(body.method || "").toLowerCase()

    if (!ALLOWED.includes(method as (typeof ALLOWED)[number])) {
      return NextResponse.json({ error: "Metodo de pagamento invalido" }, { status: 400 })
    }

    const walletAddress = typeof body.walletAddress === "string" ? body.walletAddress.trim() : ""
    const pixKey = typeof body.pixKey === "string" ? body.pixKey.trim() : ""
    const pixKeyType = typeof body.pixKeyType === "string" ? body.pixKeyType.trim() : ""

    if (method === "usdt" && walletAddress.length < 20) {
      return NextResponse.json({ error: "Informe um endereco de carteira valido" }, { status: 400 })
    }

    if (method === "pix" && (!pixKey || !pixKeyType)) {
      return NextResponse.json({ error: "Informe o tipo e a chave PIX" }, { status: 400 })
    }

    const admin = createAdminClient()

    const { count } = await admin
      .from("affiliate_payment_methods")
      .select("id", { count: "exact", head: true })
      .eq("affiliate_id", user.id)

    if ((count ?? 0) >= 10) {
      return NextResponse.json({ error: "Limite de metodos de pagamento atingido" }, { status: 400 })
    }

    const { data, error } = await admin
      .from("affiliate_payment_methods")
      .insert({
        // Colunas reais: `affiliate_id` e `type` (nao `user_id`/`method`).
        affiliate_id: user.id,
        type: method,
        wallet_address: method === "usdt" ? walletAddress : null,
        pix_key: method === "pix" ? pixKey : null,
        pix_key_type: method === "pix" ? pixKeyType : null,
        is_default: (count ?? 0) === 0,
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ method: { ...data, method: data.type } })
  } catch (error) {
    console.error("Erro ao salvar metodo de pagamento:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })
    }

    const id = new URL(request.url).searchParams.get("id")
    if (!id) {
      return NextResponse.json({ error: "Identificador obrigatorio" }, { status: 400 })
    }

    const admin = createAdminClient()
    // O filtro por dono e essencial (a chave de servico ignora RLS): sem ele, qualquer afiliado
    // poderia apagar o metodo de pagamento de outro passando um id arbitrario.
    const { error } = await admin.from("affiliate_payment_methods").delete().eq("id", id).eq("affiliate_id", user.id)

    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Erro ao remover metodo de pagamento:", error)
    return NextResponse.json({ error: "Erro interno" }, { status: 500 })
  }
}
