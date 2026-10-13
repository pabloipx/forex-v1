import { NextResponse } from "next/server"

// API de health check - nunca falha
export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    env: {
      supabaseConfigured: !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
      nodeEnv: process.env.NODE_ENV || "unknown",
    },
  })
}
