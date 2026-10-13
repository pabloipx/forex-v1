import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { cancelAllOrders, cancelOrder, placeOrder } from "@/lib/futures/engine"
import { errorResponse, requireUser } from "@/lib/futures/http"
import { MARKET_MAP } from "@/lib/futures/markets"
import { assertCanOpen } from "@/lib/futures/user-status"

const positive = z.number().finite().positive()

const orderSchema = z.object({
  account: z.enum(["demo", "real"]),
  symbol: z.string().refine((s) => s in MARKET_MAP, "Mercado inválido"),
  side: z.enum(["buy", "sell"]),
  orderType: z.enum(["market", "limit", "conditional"]),
  qty: positive,
  price: positive.nullish(),
  triggerPrice: positive.nullish(),
  leverage: z.number().int().min(1).max(1000),
  marginMode: z.enum(["isolated", "cross"]),
  reduceOnly: z.boolean().optional(),
  postOnly: z.boolean().optional(),
  timeInForce: z.enum(["GTC", "IOC", "FOK", "PostOnly"]).optional(),
  takeProfit: positive.nullish(),
  stopLoss: positive.nullish(),
})

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser()
    const parsed = orderSchema.safeParse(await request.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Dados inválidos" }, { status: 400 })
    }
    if (!parsed.data.reduceOnly) await assertCanOpen(user.id)
    const result = await placeOrder(user.id, parsed.data)
    return NextResponse.json({ success: true, result })
  } catch (e) {
    return errorResponse(e)
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireUser()
    const params = request.nextUrl.searchParams
    const id = params.get("id")
    if (id) {
      if (!z.string().uuid().safeParse(id).success) {
        return NextResponse.json({ error: "Ordem inválida" }, { status: 400 })
      }
      return NextResponse.json({ success: true, result: await cancelOrder(user.id, id) })
    }
    const isDemo = params.get("account") === "demo"
    const symbol = params.get("symbol") ?? undefined
    return NextResponse.json({ success: true, result: await cancelAllOrders(user.id, isDemo, symbol) })
  } catch (e) {
    return errorResponse(e)
  }
}
