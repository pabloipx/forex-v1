import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { isAdminRequest, unauthorizedResponse } from "@/lib/admin/session"
import { errorResponse } from "@/lib/futures/http"
import { MARKET_MAP } from "@/lib/futures/markets"
import {
  adjustBalance,
  forceCancelOrder,
  forceClosePosition,
  getOverview,
  listAdjustments,
  listKyc,
  listMarketSettings,
  listOpenOrders,
  listOpenPositions,
  listUsers,
  listWithdrawals,
  listDeposits,
  reviewWithdrawal,
  reviewDeposit,
  reviewKyc,
  setUserBlocked,
  signKycFile,
  updateMarket,
} from "@/lib/admin/forex-admin"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const views = {
  overview: getOverview,
  positions: listOpenPositions,
  orders: listOpenOrders,
  users: listUsers,
  markets: listMarketSettings,
  kyc: listKyc,
  adjustments: listAdjustments,
  withdrawals: listWithdrawals,
  deposits: listDeposits,
} as const

export async function GET(request: NextRequest) {
  if (!(await isAdminRequest())) return unauthorizedResponse()
  const view = request.nextUrl.searchParams.get("view") as keyof typeof views | null
  if (!view || !(view in views)) return NextResponse.json({ error: "Visão inválida" }, { status: 400 })
  try {
    return NextResponse.json({ data: await views[view]() })
  } catch (e) {
    return errorResponse(e)
  }
}

const uuid = z.string().min(1).max(64)

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("close_position"), userId: uuid, positionId: uuid }),
  z.object({ action: z.literal("cancel_order"), userId: uuid, orderId: uuid }),
  z.object({
    action: z.literal("block_user"),
    userId: uuid,
    blocked: z.boolean(),
    reason: z.string().trim().max(500).nullish(),
  }),
  z.object({
    action: z.literal("adjust_balance"),
    userId: uuid,
    isDemo: z.boolean(),
    amount: z.number().finite(),
    note: z.string().max(200).nullish(),
  }),
  z.object({ action: z.literal("review_kyc"), id: uuid, approve: z.boolean(), reason: z.string().max(300).nullish() }),
  z.object({ action: z.literal("kyc_file"), path: z.string().min(1).max(500) }),
  z.object({
    action: z.literal("review_withdrawal"),
    id: z.string().uuid(),
    status: z.enum(["approved", "paid", "rejected"]),
    reason: z.string().max(300).nullish(),
  }),
  z.object({ action: z.literal("review_deposit"), id: z.string().uuid(), confirm: z.boolean() }),
  z.object({
    action: z.literal("update_market"),
    symbol: z.string().refine((s) => s in MARKET_MAP, "Mercado inválido"),
    enabled: z.boolean().optional(),
    maxLeverage: z.number().int().min(1).max(1000).optional(),
    takerFee: z.number().min(0).max(0.01).optional(),
    makerFee: z.number().min(-0.001).max(0.01).optional(),
    spreadBps: z.number().min(0).max(500).optional(),
  }),
])

export async function POST(request: NextRequest) {
  if (!(await isAdminRequest())) return unauthorizedResponse()
  const parsed = actionSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 })
  }
  const a = parsed.data
  try {
    switch (a.action) {
      case "close_position":
        return NextResponse.json({ success: true, result: await forceClosePosition(a.userId, a.positionId) })
      case "cancel_order":
        return NextResponse.json({ success: true, result: await forceCancelOrder(a.userId, a.orderId) })
      case "block_user":
        await setUserBlocked(a.userId, a.blocked, a.reason ?? null)
        return NextResponse.json({ success: true })
      case "adjust_balance":
        return NextResponse.json({ success: true, balance: await adjustBalance(a.userId, a.isDemo, a.amount, a.note ?? null) })
      case "review_kyc":
        await reviewKyc(a.id, a.approve, a.reason ?? null)
        return NextResponse.json({ success: true })
      case "review_withdrawal":
        return NextResponse.json({ success: true, status: await reviewWithdrawal(a.id, a.status, a.reason ?? null) })
      case "review_deposit":
        return NextResponse.json({ success: true, status: await reviewDeposit(a.id, a.confirm) })
      case "kyc_file":
        return NextResponse.json({ success: true, url: await signKycFile(a.path) })
      case "update_market": {
        const { action: _action, symbol, ...patch } = a
        return NextResponse.json({ success: true, market: await updateMarket(symbol, patch) })
      }
    }
  } catch (e) {
    return errorResponse(e)
  }
}
