import { NextResponse } from "next/server"
import { listLaunches } from "@/lib/launches"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const launches = await listLaunches({ onlyVisible: true })
    return NextResponse.json({ data: launches }, { headers: { "Cache-Control": "no-store" } })
  } catch {
    return NextResponse.json({ error: "Lançamentos indisponíveis" }, { status: 503 })
  }
}
