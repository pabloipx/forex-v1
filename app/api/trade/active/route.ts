import { NextResponse } from "next/server"

export async function GET() {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
      return NextResponse.json({ activeTrade: null })
    }

    const { createClient } = await import("@/lib/supabase/server")
    const supabase = await createClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: trade, error } = await supabase
      .from("trades")
      .select("*")
      .eq("user_id", user.id)
      .eq("result", "PENDING")
      .order("entry_time", { ascending: false })
      .limit(1)
      .single()

    if (error || !trade) {
      return NextResponse.json({ activeTrade: null })
    }

    return NextResponse.json({ activeTrade: trade })
  } catch {
    return NextResponse.json({ activeTrade: null })
  }
}
