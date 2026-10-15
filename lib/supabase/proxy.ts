import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

const PROTECTED_ROUTES = ["/trade", "/profile", "/transactions", "/withdraw", "/deposit", "/settings", "/help"]

export async function updateSession(request: NextRequest) {
  // Se Supabase não está configurado, apenas passa adiante
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  if (request.nextUrl.pathname === "/trade" || request.nextUrl.pathname.startsWith("/trade/")) {
    const url = request.nextUrl.clone()
    url.pathname = "/futures"
    return NextResponse.redirect(url, 308)
  }

  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
        },
      },
    })

    // getClaims valida o JWT localmente (JWKS em cache) e so vai a rede quando precisa renovar a sessao.
    const { data } = await supabase.auth.getClaims()
    const user = data?.claims?.sub ? data.claims : null

    const isProtectedRoute = PROTECTED_ROUTES.some((route) => request.nextUrl.pathname.startsWith(route))

    if (isProtectedRoute && !user) {
      const url = request.nextUrl.clone()
      url.pathname = "/auth/login"
      return NextResponse.redirect(url)
    }

    if (user && request.nextUrl.pathname.startsWith("/auth/")) {
      const url = request.nextUrl.clone()
      url.pathname = "/futures"
      return NextResponse.redirect(url)
    }
  } catch {
    // Erro silencioso - permite requisição continuar
  }

  return supabaseResponse
}
