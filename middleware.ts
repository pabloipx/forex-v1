import { NextResponse, type NextRequest } from "next/server"

// Middleware 100% seguro para Vercel Serverless
// Nunca falha, sempre retorna uma resposta válida
export async function middleware(request: NextRequest) {
  try {
    // Se Supabase não está configurado, apenas passa a requisição adiante
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.next()
    }

    // Importação dinâmica para evitar erros em tempo de build
    const { updateSession } = await import("@/lib/supabase/proxy")
    return await updateSession(request)
  } catch {
    // Em caso de qualquer erro, apenas continua sem interromper
    return NextResponse.next()
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
