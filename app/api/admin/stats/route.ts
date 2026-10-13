import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { isAdminRequest } from "@/lib/admin/session"


async function isAdminAuthenticated(): Promise<boolean> {
  return isAdminRequest()
}

export async function GET(request: Request) {
  try {
    if (!(await isAdminAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized", details: "Invalid admin token" }, { status: 401 })
    }

    const adminClient = createAdminClient()

    // Total users
    const { count: totalUsers } = await adminClient.from("profiles").select("*", { count: "exact", head: true })

    // Deposits
    const { data: deposits } = await adminClient.from("deposits").select("amount, status")
    const totalDeposits =
      deposits?.filter((d) => d.status === "completed").reduce((sum, d) => sum + Number(d.amount || 0), 0) || 0
    const pendingDeposits = deposits?.filter((d) => d.status === "pending").length || 0

    // Withdrawals
    const { data: withdrawals } = await adminClient.from("withdrawals").select("amount, status")
    const totalWithdrawals =
      withdrawals?.filter((w) => w.status === "completed").reduce((sum, w) => sum + Number(w.amount || 0), 0) || 0
    const pendingWithdrawals = withdrawals?.filter((w) => w.status === "pending").length || 0

    // Balances
    const { data: balancesData } = await adminClient.from("user_balances").select("balance_real")
    const totalBalance = balancesData?.reduce((sum, b) => sum + Number(b.balance_real || 0), 0) || 0

    // Trades
    const { data: tradesData } = await adminClient.from("trades").select("amount, profit, result, is_demo")
    const realTrades = tradesData?.filter((t) => !t.is_demo) || []
    const totalTrades = realTrades.length
    const wins = realTrades.filter((t) => t.result === "WIN" || t.result === "win").length
    const losses = realTrades.filter((t) => t.result === "LOSS" || t.result === "loss").length

    // Platform profit = user losses - user wins
    const platformProfit =
      realTrades
        .filter((t) => t.result === "LOSS" || t.result === "loss")
        .reduce((sum, t) => sum + Number(t.amount || 0), 0) -
      realTrades
        .filter((t) => t.result === "WIN" || t.result === "win")
        .reduce((sum, t) => sum + Number(t.profit || 0), 0)

    const stats = {
      totalUsers: totalUsers || 0,
      totalDeposits,
      totalWithdrawals,
      totalBalance,
      totalTrades,
      pendingDeposits,
      pendingWithdrawals,
      wins,
      losses,
      winRate: wins + losses > 0 ? (wins / (wins + losses)) * 100 : 0,
      platformProfit,
    }

    return NextResponse.json(stats)
  } catch (error) {
    return NextResponse.json({ error: "Internal server error", details: String(error) }, { status: 500 })
  }
}
