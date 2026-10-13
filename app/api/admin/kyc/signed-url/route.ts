import { createClient } from "@supabase/supabase-js"
import { type NextRequest, NextResponse } from "next/server"
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

export async function POST(req: NextRequest) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 })
  }

  try {
    const supabase = getAdminClient()
    const { path } = await req.json()

    if (!path) {
      return NextResponse.json({ error: "Path não fornecido" }, { status: 400 })
    }

    let cleanPath = path

    // Se o path já for uma URL completa, extrair apenas o path do arquivo
    if (path.includes("/storage/v1/object/")) {
      const match = path.match(/kyc-documents\/(.+)$/)
      if (match) {
        cleanPath = match[1]
      }
    }

    // Remover barras iniciais
    cleanPath = cleanPath.replace(/^\/+/, "")

    // KYC Signed URL processing

    const { data: signedData, error: signedError } = await supabase.storage
      .from("kyc-documents")
      .createSignedUrl(cleanPath, 3600) // 1 hora

    if (signedData?.signedUrl) {
      return NextResponse.json({ url: signedData.signedUrl })
    }

    const { data: publicData } = supabase.storage.from("kyc-documents").getPublicUrl(cleanPath)

    if (publicData?.publicUrl) {
      return NextResponse.json({ url: publicData.publicUrl })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const manualUrl = `${supabaseUrl}/storage/v1/object/public/kyc-documents/${cleanPath}`

    return NextResponse.json({ url: manualUrl })
  } catch (error: any) {
    console.error("KYC Signed URL Error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
