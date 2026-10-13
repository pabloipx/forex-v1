import { createClient } from "@supabase/supabase-js"
import { type NextRequest, NextResponse } from "next/server"

// Função para obter admin client
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ""
  const key = process.env.SUPABASE_SECRET_KEY || ""
  return createClient(url, key)
}

export async function POST(request: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin()
  
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const userId = formData.get("userId") as string
    const type = formData.get("type") as string // front, back, selfie

    if (!file || !userId || !type) {
      return NextResponse.json({ error: "Dados incompletos" }, { status: 400 })
    }

    const timestamp = Date.now()
    const fileName = `${userId}/${type}_${timestamp}.jpg`

    // Converter File para ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    // Upload usando admin client
    const { data, error } = await supabaseAdmin.storage.from("kyc-documents").upload(fileName, buffer, {
      contentType: file.type,
      upsert: true,
    })

    if (error) {
      console.error("Upload error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Gerar URL (usar signed URL já que o bucket é privado)
    const { data: urlData } = await supabaseAdmin.storage
      .from("kyc-documents")
      .createSignedUrl(fileName, 60 * 60 * 24 * 365) // URL válida por 1 ano

    return NextResponse.json({
      success: true,
      path: data.path,
      url: urlData?.signedUrl || data.path,
    })
  } catch (error: any) {
    console.error("KYC upload error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
