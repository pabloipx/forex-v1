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
    const { userId, documentFrontPath, documentBackPath, selfiePath } = await request.json()

    if (!userId || !documentFrontPath || !documentBackPath || !selfiePath) {
      return NextResponse.json({ error: "Dados incompletos" }, { status: 400 })
    }

    // Criar solicitação KYC
    const { error: kycError } = await supabaseAdmin.from("kyc_requests").insert({
      user_id: userId,
      document_front_url: documentFrontPath,
      document_back_url: documentBackPath,
      selfie_with_document_url: selfiePath,
      status: "pending",
    })

    if (kycError) {
      console.error("KYC request error:", kycError)
      return NextResponse.json({ error: kycError.message }, { status: 500 })
    }

    // Atualizar status do perfil
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ kyc_status: "pending" })
      .eq("id", userId)

    if (profileError) {
      console.error("Profile update error:", profileError)
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("KYC submit error:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
