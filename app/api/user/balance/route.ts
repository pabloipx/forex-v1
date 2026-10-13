import { NextResponse } from "next/server"

export async function GET() {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
      return NextResponse.json({ balance: 0, currency: "USD" })
    }

    const { createClient } = await import("@/lib/supabase/server")
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data, error } = await supabase
      .from("user_balances")
      .select("balance, currency")
      .eq("user_id", user.id)
      .single()

    if (error || !data) {
      return NextResponse.json({ balance: 0, currency: "USD" })
    }

    return NextResponse.json({ balance: data.balance, currency: data.currency })
  } catch {
    return NextResponse.json({ balance: 0, currency: "USD" })
  }
}
