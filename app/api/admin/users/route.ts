import { createAdminClient } from "@/lib/supabase/admin"
import { NextResponse } from "next/server"
import { isAdminRequest } from "@/lib/admin/session"

const ADMIN_EMAILS = ["pablotrader1790@gmail.com", "pabloandrade1790@gmail.com", "admin@atlasinvest.com"]

async function isAdminAuthenticated(): Promise<boolean> {
  return isAdminRequest()
}

export async function GET(request: Request) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized", details: "Invalid admin token" }, { status: 401 })
    }

    const adminClient = createAdminClient()

    // Buscar todos os usuários usando admin client (ignora RLS)
    const { data: users, error: usersError } = await adminClient
      .from("profiles")
      .select(`
        *,
        user_balances (
          balance_real,
          balance_demo
        )
      `)
      .order("created_at", { ascending: false })

    if (usersError) {
      return NextResponse.json({ error: "Failed to fetch users", details: usersError.message }, { status: 500 })
    }

    const mappedUsers = (users || []).map((u: any) => ({
      id: u.id,
      email: u.email || "",
      full_name: u.full_name || "",
      phone: u.phone || "",
      is_blocked: u.is_blocked || false,
      is_verified: u.is_verified || false,
      is_admin: u.is_admin || false,
      created_at: u.created_at,
      balance_real: u.user_balances?.[0]?.balance_real || 0,
      balance_demo: u.user_balances?.[0]?.balance_demo || 0,
    }))

    return NextResponse.json(mappedUsers)
  } catch (error) {
    return NextResponse.json({ error: "Internal server error", details: String(error) }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const adminClient = createAdminClient()
    const body = await request.json()
    const { userId, full_name, phone, balance_real, balance_demo, is_blocked, is_verified } = body

    if (!userId) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 })
    }

    // Update profile
    const { error: profileError } = await adminClient
      .from("profiles")
      .update({
        full_name,
        phone,
        is_blocked,
        is_verified,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId)

    if (profileError) {
      return NextResponse.json({ error: "Failed to update profile", details: profileError.message }, { status: 500 })
    }

    // Update or insert balance
    const { error: balanceError } = await adminClient.from("user_balances").upsert(
      {
        user_id: userId,
        balance_real: Number(balance_real) || 0,
        balance_demo: Number(balance_demo) || 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )

    if (balanceError) {
      return NextResponse.json({ error: "Failed to update balance", details: balanceError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: "Internal server error", details: String(error) }, { status: 500 })
  }
}
