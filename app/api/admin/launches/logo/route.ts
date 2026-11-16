import { randomUUID } from "node:crypto"
import { NextResponse, type NextRequest } from "next/server"
import { isAdminRequest, unauthorizedResponse } from "@/lib/admin/session"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"

const BUCKET = "launch-logos"
const MAX_BYTES = 2 * 1024 * 1024

// Identify the format from the file's first bytes so a renamed file can't pass as an image.
function detectImage(b: Uint8Array): { ext: string; type: string } | null {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { ext: "png", type: "image/png" }
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { ext: "jpg", type: "image/jpeg" }
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return { ext: "gif", type: "image/gif" }
  const riff = String.fromCharCode(...b.slice(0, 4))
  const webp = String.fromCharCode(...b.slice(8, 12))
  if (riff === "RIFF" && webp === "WEBP") return { ext: "webp", type: "image/webp" }
  return null
}

async function ensureBucket() {
  const storage = createAdminClient().storage
  const { error } = await storage.getBucket(BUCKET)
  if (!error) return
  const { error: createError } = await storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: MAX_BYTES,
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/gif"],
  })
  if (createError && !/already exists/i.test(createError.message)) throw new Error(createError.message)
}

export async function POST(request: NextRequest) {
  if (!(await isAdminRequest())) return unauthorizedResponse()

  const form = await request.formData().catch(() => null)
  const file = form?.get("file")
  if (!(file instanceof File)) return NextResponse.json({ error: "Envie uma imagem" }, { status: 400 })
  if (file.size === 0) return NextResponse.json({ error: "Arquivo vazio" }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Imagem muito grande. Máximo 2 MB." }, { status: 400 })

  const bytes = new Uint8Array(await file.arrayBuffer())
  const image = detectImage(bytes)
  if (!image) return NextResponse.json({ error: "Formato não suportado. Use PNG, JPG, WEBP ou GIF." }, { status: 400 })

  try {
    await ensureBucket()
    const path = `${randomUUID()}.${image.ext}`
    const storage = createAdminClient().storage.from(BUCKET)
    const { error } = await storage.upload(path, bytes, {
      contentType: image.type,
      cacheControl: "31536000",
      upsert: false,
    })
    if (error) throw new Error(error.message)
    const { data } = storage.getPublicUrl(path)
    return NextResponse.json({ url: data.publicUrl })
  } catch (e) {
    console.error("[admin] launch logo upload failed", e)
    return NextResponse.json({ error: "Não foi possível enviar a imagem. Tente novamente." }, { status: 500 })
  }
}
