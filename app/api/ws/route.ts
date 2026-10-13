import { NextResponse } from "next/server"

/**
 * WebSocket API placeholder
 * Note: WebSockets are not directly supported in Next.js API routes.
 * Price updates are handled via polling or Server-Sent Events.
 */

export async function GET() {
  return NextResponse.json({
    message: "WebSocket not supported in serverless environment. Use polling instead.",
    polling_endpoint: "/api/price/stream",
  })
}
