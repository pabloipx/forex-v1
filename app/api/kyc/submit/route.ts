import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

const PATH_RE = /^[0-9a-f-]{36}\/[\w.-]{1,120}$/i

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 })

  const body = await request.json().catch(() => null)
  const front = String(body?.documentFrontPath ?? "")
  const back = String(body?.documentBackPath ?? "")
  const selfie = String(body?.selfiePath ?? "")
  const docType = ["rg", "cnh", "passport"].includes(body?.documentType) ? body.documentType : "rg"

  const ownPath = (p: string) => PATH_RE.test(p) && p.startsWith(`${user.id}/`)
  if (!ownPath(front) || !ownPath(back) || !ownPath(selfie)) {
    return NextResponse.json({ error: "Envie frente, verso e selfie do documento" }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: pending } = await admin
    .from("kyc_submissions")
    .select("id")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .limit(1)
  if (pending?.length) {
    return NextResponse.json({ error: "Você já tem uma verificação em análise" }, { status: 409 })
  }

  const { error } = await admin.from("kyc_submissions").insert({
    user_id: user.id,
    status: "pending",
    document_type: docType,
    document_front_path: front,
    document_back_path: back,
    selfie_path: selfie,
    provider: "manual",
  })
  if (error) {
    console.error("[kyc] insert error:", error.message)
    return NextResponse.json({ error: "Não foi possível enviar os documentos" }, { status: 500 })
  }

  await admin.from("profiles").update({ kyc_status: "pending" }).eq("id", user.id)
  return NextResponse.json({ success: true })
}
