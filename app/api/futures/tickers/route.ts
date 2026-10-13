import { NextResponse } from "next/server"
import { getAllTickers } from "@/lib/futures/prices"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const tickers = await getAllTickers()
    return NextResponse.json({ tickers }, { headers: { "Cache-Control": "no-store" } })
  } catch {
    return NextResponse.json({ tickers: {} }, { status: 503 })
  }
}
