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
      .select("balance_real, currency")
      .eq("user_id", user.id)
      .maybeSingle()

    if (error || !data) {
      return NextResponse.json({ balance: 0, currency: "USD" })
    }

    return NextResponse.json({ balance: Number(data.balance_real ?? 0), currency: data.currency ?? "USD" })
  } catch {
    return NextResponse.json({ balance: 0, currency: "USD" })
  }
}
