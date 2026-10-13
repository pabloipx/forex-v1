import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { isAdminRequest } from "@/lib/admin/session"


function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY || ""

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

async function checkAuth(): Promise<boolean> {
  return isAdminRequest()
}

export async function POST(req: NextRequest) {
  if (!(await checkAuth())) {
    return NextResponse.json({ error: "Nao autorizado" }, { status: 401 })
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 })
  }

  try {
    const supabase = getAdminClient()
    const { path } = await req.json()

    if (!path) {
      return NextResponse.json({ error: "Path é obrigatório" }, { status: 400 })
    }

    let cleanPath = path

    // Se o path já for uma URL completa, extrair apenas o path do arquivo
    if (path.includes("/storage/v1/object/")) {
      const match = path.match(/kyc-documents\/(.+)$/)
      if (match) {
        cleanPath = match[1]
      }
    }

    // Remover barras iniciais e prefixo do bucket
    cleanPath = cleanPath.replace(/^\/+/, "")
    if (cleanPath.startsWith("kyc-documents/")) {
      cleanPath = cleanPath.slice("kyc-documents/".length)
    }

    console.log("[v0] Creating signed URL for:", { cleanPath, originalPath: path })

    // Tentar criar URL assinada
    const { data: signedData, error: signedError } = await supabase.storage
      .from("kyc-documents")
      .createSignedUrl(cleanPath, 3600) // 1 hora

    if (signedData?.signedUrl) {
      console.log("[v0] Signed URL created successfully")
      return NextResponse.json({ url: signedData.signedUrl })
    }

    console.log("[v0] Signed URL error:", signedError)

    // Fallback para URL pública
    const { data: publicData } = supabase.storage.from("kyc-documents").getPublicUrl(cleanPath)

    if (publicData?.publicUrl) {
      console.log("[v0] Using public URL as fallback")
      return NextResponse.json({ url: publicData.publicUrl })
    }

    // Último fallback: URL manual
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const manualUrl = `${supabaseUrl}/storage/v1/object/public/kyc-documents/${cleanPath}`
    console.log("[v0] Using manual URL:", manualUrl)

    return NextResponse.json({ url: manualUrl })
  } catch (error: any) {
    console.log("[v0] Signed URL exception:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
