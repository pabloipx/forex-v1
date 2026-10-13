import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * Get user's trade history
 */
export async function GET(request: Request) {
  try {
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "50")
    const offset = Number.parseInt(searchParams.get("offset") || "0")

    // Fetch trade history
    const { data: trades, error } = await supabase
      .from("trades")
      .select("*")
      .eq("user_id", user.id)
      .order("entry_time", { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      return NextResponse.json({ error: "Failed to fetch trade history" }, { status: 500 })
    }

    // Calculate statistics
    const wins = trades?.filter((t) => t.result === "WIN").length || 0
    const losses = trades?.filter((t) => t.result === "LOSS").length || 0
    const totalProfit = trades?.reduce((sum, t) => sum + (t.profit || 0), 0) || 0

    return NextResponse.json({
      trades: trades || [],
      stats: {
        total: trades?.length || 0,
        wins,
        losses,
        winRate: trades?.length ? (wins / (wins + losses)) * 100 : 0,
        totalProfit,
      },
    })
  } catch (error) {
    console.error("[v0] Error fetching trade history:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
