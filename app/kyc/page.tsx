"use client"

import { useState, useEffect, useRef, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  ArrowLeft,
  Upload,
  Camera,
  CheckCircle,
  Clock,
  XCircle,
  Loader2,
  AlertTriangle,
  Check,
  IdCard,
  ScanFace,
} from "lucide-react"

export default function KYCPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [uploadingFront, setUploadingFront] = useState(false)
  const [uploadingBack, setUploadingBack] = useState(false)
  const [uploadingSelfie, setUploadingSelfie] = useState(false)
  const [kycStatus, setKycStatus] = useState<string>("unverified")
  const [rejectionReason, setRejectionReason] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [documentFrontPath, setDocumentFrontPath] = useState<string | null>(null)
  const [documentBackPath, setDocumentBackPath] = useState<string | null>(null)
  const [selfiePath, setSelfiePath] = useState<string | null>(null)

  const [documentFrontPreview, setDocumentFrontPreview] = useState<string | null>(null)
  const [documentBackPreview, setDocumentBackPreview] = useState<string | null>(null)
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null)

  const frontInputRef = useRef<HTMLInputElement>(null)
  const backInputRef = useRef<HTMLInputElement>(null)
  const selfieInputRef = useRef<HTMLInputElement>(null)

  const supabase = createClient()

  useEffect(() => {
    checkKYCStatus()
  }, [])

  async function checkKYCStatus() {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        router.push("/auth/login")
        return
      }

      setUserId(user.id)

      const { data: profile } = await supabase.from("profiles").select("kyc_status").eq("id", user.id).single()

      // Check if there are actual documents submitted
      const { data: kycRequests, error: kycError } = await supabase
        .from("kyc_requests")
        .select("id, status, rejection_reason, document_front_url")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)

      // Get the most recent request (if any)
      const kycRequest = kycRequests && kycRequests.length > 0 ? kycRequests[0] : null

      // Determine actual status based on documents existence
      let actualStatus = "unverified"
      
      // Only show "pending" (Em Análise) if there's an actual document uploaded
      if (kycRequest && kycRequest.document_front_url && kycRequest.document_front_url.trim() !== "") {
        // Documents exist - use the request status
        actualStatus = kycRequest.status || "pending"
        
        if (kycRequest.status === "rejected" && kycRequest.rejection_reason) {
          setRejectionReason(kycRequest.rejection_reason)
        }
      } else if (profile?.kyc_status === "approved") {
        // Already approved (legacy)
        actualStatus = "approved"
      } else {
        // No documents or empty URL - always show unverified
        actualStatus = "unverified"
      }

      setKycStatus(actualStatus)
    } catch (error) {
      console.error("Error checking KYC status:", error)
      setKycStatus("unverified")
    } finally {
      setLoading(false)
    }
  }

  // Comprime/redimensiona a imagem no navegador para evitar arquivos gigantes
  // (fotos de celular podem ter 5-10MB, o que estoura o limite de upload do servidor).
  async function compressImage(file: File): Promise<Blob> {
    // Se não for imagem, retorna o arquivo original
    if (!file.type.startsWith("image/")) return file

    return new Promise((resolve) => {
      const img = document.createElement("img")
      const objectUrl = URL.createObjectURL(file)

      img.onload = () => {
        URL.revokeObjectURL(objectUrl)
        const maxDimension = 1600
        let { width, height } = img

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width)
            width = maxDimension
          } else {
            width = Math.round((width * maxDimension) / height)
            height = maxDimension
          }
        }

        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          resolve(file)
          return
        }
        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob(
          (blob) => resolve(blob || file),
          "image/jpeg",
          0.8,
        )
      }

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl)
        resolve(file)
      }

      img.src = objectUrl
    })
  }

  async function uploadFile(type: "front" | "back" | "selfie", file: File) {
    if (!userId) return

    if (type === "front") setUploadingFront(true)
    else if (type === "back") setUploadingBack(true)
    else setUploadingSelfie(true)

    try {
      const reader = new FileReader()
      reader.onloadend = () => {
        const preview = reader.result as string
        if (type === "front") setDocumentFrontPreview(preview)
        else if (type === "back") setDocumentBackPreview(preview)
        else setSelfiePreview(preview)
      }
      reader.readAsDataURL(file)

      // Comprime a imagem antes de enviar
      const compressed = await compressImage(file)

      const typeKey = type === "front" ? "document_front" : type === "back" ? "document_back" : "selfie"
      const fileName = `${userId}/${typeKey}_${Date.now()}.jpg`

      // Upload direto do navegador para o Supabase Storage (contorna o limite
      // de tamanho de corpo das rotas de API do servidor).
      const { data, error: uploadError } = await supabase.storage
        .from("kyc-documents")
        .upload(fileName, compressed, {
          contentType: "image/jpeg",
          upsert: false,
        })

      if (uploadError) {
        throw new Error(uploadError.message || "Erro ao fazer upload")
      }

      const path = data.path

      if (type === "front") setDocumentFrontPath(path)
      else if (type === "back") setDocumentBackPath(path)
      else setSelfiePath(path)

      setError(null)
    } catch (err: any) {
      console.error("Upload error:", err)
      setError(err.message)
    } finally {
      if (type === "front") setUploadingFront(false)
      else if (type === "back") setUploadingBack(false)
      else setUploadingSelfie(false)
    }
  }

  async function handleSubmit() {
    if (!documentFrontPath || !documentBackPath || !selfiePath || !userId) {
      setError("Por favor, envie todos os documentos necessários")
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch("/api/kyc/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          documentFrontPath,
          documentBackPath,
          selfiePath,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Erro ao enviar documentos")
      }

      setKycStatus("pending")
      setSuccess(true)
    } catch (err: any) {
      console.error("Submit error:", err)
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  const uploadedCount = [documentFrontPath, documentBackPath, selfiePath].filter(Boolean).length
  const allUploaded = uploadedCount === 3

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    )
  }

  if (kycStatus === "approved") {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 bg-card border-b border-border">
          <div className="flex items-center justify-between p-4">
            <button onClick={() => router.back()} className="p-2 hover:bg-muted rounded-lg">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-lg font-semibold">Verificação de Conta</h1>
            <div className="w-9" />
          </div>
        </header>

        <div className="p-4 max-w-lg mx-auto">
          <Card className="border-green-500/30 bg-orange-500/5">
            <CardContent className="pt-6">
              <div className="text-center py-8">
                <div className="w-20 h-20 rounded-full bg-orange-500/20 flex items-center justify-center mx-auto mb-6">
                  <CheckCircle className="h-10 w-10 text-orange-500" />
                </div>
                <h2 className="text-2xl font-bold text-orange-500 mb-2">Conta Verificada</h2>
                <p className="text-muted-foreground mb-6">
                  Sua conta foi verificada com sucesso! Você tem acesso completo a todas as funcionalidades, incluindo
                  saques.
                </p>
                <div className="space-y-3">
                  <Button onClick={() => router.push("/withdraw")} className="w-full bg-orange-600 hover:bg-orange-700">
                    Fazer Saque
                  </Button>
                  <Button onClick={() => router.push("/trade")} variant="outline" className="w-full">
                    Voltar ao Trading
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card border-b border-border">
        <div className="flex items-center justify-between p-4">
          <button onClick={() => router.back()} className="p-2 hover:bg-muted rounded-lg">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-lg font-semibold">Verificação de Conta</h1>
          <div className="w-9" />
        </div>
      </header>

      <div className="p-4 max-w-lg mx-auto space-y-6">
        {/* Success Message */}
        {success && (
          <Card className="border-green-500 bg-orange-500/10">
            <CardContent className="pt-6">
              <div className="text-center">
                <CheckCircle className="h-12 w-12 text-orange-500 mx-auto mb-3" />
                <p className="text-orange-500 font-semibold">Documentos enviados com sucesso!</p>
                <p className="text-muted-foreground text-sm mt-2">Aguarde a análise em até 24 horas.</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error Message */}
        {error && (
          <Card className="border-red-500 bg-red-500/10">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-red-500">
                <XCircle className="h-5 w-5" />
                <p>{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Status Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              {kycStatus === "pending" && <Clock className="h-5 w-5 text-orange-500" />}
              {kycStatus === "rejected" && <XCircle className="h-5 w-5 text-red-500" />}
              {kycStatus === "unverified" && <AlertTriangle className="h-5 w-5 text-orange-500" />}
              Status da Verificação
            </CardTitle>
          </CardHeader>
          <CardContent>
            {kycStatus === "pending" && (
              <div className="text-center py-4">
                <Clock className="h-16 w-16 text-orange-500 mx-auto mb-4" />
                <p className="text-orange-500 font-semibold text-lg">Em Análise</p>
                <p className="text-muted-foreground mt-2">
                  Seus documentos foram enviados e estão sendo analisados. Aguarde a aprovação em até 24 horas.
                </p>
              </div>
            )}

            {kycStatus === "rejected" && (
              <div className="text-center py-4">
                <XCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
                <p className="text-red-500 font-semibold text-lg">Verificação Rejeitada</p>
                {rejectionReason && <p className="text-muted-foreground mt-2">Motivo: {rejectionReason}</p>}
                <p className="text-muted-foreground mt-2">Por favor, envie novos documentos.</p>
              </div>
            )}

            {kycStatus === "unverified" && (
              <div className="text-center py-4">
                <AlertTriangle className="h-16 w-16 text-orange-500 mx-auto mb-4" />
                <p className="text-orange-500 font-semibold text-lg">Aguardando Documento</p>
                <p className="text-muted-foreground mt-2">
                  Para realizar saques, você precisa verificar sua conta enviando seus documentos abaixo.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upload Form - Show only if unverified or rejected (not when pending/in analysis) */}
        {(kycStatus === "unverified" || kycStatus === "rejected") && !success && (
          <>
            {/* Inputs de arquivo ocultos, acionados pelos cards abaixo */}
            <input
              ref={frontInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) uploadFile("front", file)
              }}
            />
            <input
              ref={backInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) uploadFile("back", file)
              }}
            />
            <input
              ref={selfieInputRef}
              type="file"
              accept="image/*"
              capture="user"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) uploadFile("selfie", file)
              }}
            />

            <DocumentStep
              step={1}
              icon={<IdCard className="h-5 w-5" />}
              title="Frente do Documento"
              description="RG, CNH ou Passaporte. Foto nítida, sem reflexos e com todas as bordas visíveis."
              actionLabel="Tirar foto ou escolher arquivo"
              alt="Frente do documento"
              preview={documentFrontPreview}
              uploaded={!!documentFrontPath}
              uploading={uploadingFront}
              onPick={() => frontInputRef.current?.click()}
            />

            <DocumentStep
              step={2}
              icon={<IdCard className="h-5 w-5" />}
              title="Verso do Documento"
              description="Parte de trás do mesmo documento enviado acima."
              actionLabel="Tirar foto ou escolher arquivo"
              alt="Verso do documento"
              preview={documentBackPreview}
              uploaded={!!documentBackPath}
              uploading={uploadingBack}
              onPick={() => backInputRef.current?.click()}
            />

            <DocumentStep
              step={3}
              icon={<ScanFace className="h-5 w-5" />}
              title="Selfie com Documento"
              description="Tire uma foto segurando o documento ao lado do rosto, em local bem iluminado."
              actionLabel="Tirar selfie"
              alt="Selfie com documento"
              preview={selfiePreview}
              uploaded={!!selfiePath}
              uploading={uploadingSelfie}
              onPick={() => selfieInputRef.current?.click()}
            />

            {/* Barra de envio fixa no rodapé com contador e progresso */}
            <div className="sticky bottom-0 -mx-4 mt-2 border-t border-border bg-background/90 px-4 pb-4 pt-3 backdrop-blur">
              <div className="mx-auto max-w-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    {uploadedCount}/3 documentos enviados
                  </span>
                  <div className="flex gap-1.5">
                    {[documentFrontPath, documentBackPath, selfiePath].map((p, i) => (
                      <span
                        key={i}
                        className={`h-1.5 w-8 rounded-full transition-colors ${p ? "bg-orange-500" : "bg-muted"}`}
                      />
                    ))}
                  </div>
                </div>
                <Button
                  className="h-13 w-full bg-orange-600 py-4 text-base font-semibold hover:bg-orange-700 disabled:opacity-50"
                  onClick={handleSubmit}
                  disabled={submitting || !allUploaded}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-5 w-5" />
                      {allUploaded ? "Enviar Documentos" : `Envie os ${3 - uploadedCount} documentos restantes`}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function DocumentStep({
  step,
  icon,
  title,
  description,
  actionLabel,
  alt,
  preview,
  uploaded,
  uploading,
  onPick,
}: {
  step: number
  icon: ReactNode
  title: string
  description: string
  actionLabel: string
  alt: string
  preview: string | null
  uploaded: boolean
  uploading: boolean
  onPick: () => void
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="flex items-start gap-3 p-4 pb-3">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors ${
            uploaded ? "bg-orange-500 text-white" : "bg-muted text-muted-foreground"
          }`}
        >
          {uploaded ? <Check className="h-4 w-4" /> : step}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-foreground">
            <span className="text-muted-foreground">{icon}</span>
            <h3 className="font-semibold leading-tight">{title}</h3>
          </div>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground text-pretty">{description}</p>
        </div>
      </div>

      <div className="px-4 pb-4">
        {preview ? (
          <div className="relative overflow-hidden rounded-xl border border-border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview || "/placeholder.svg"} alt={alt} className="h-48 w-full object-cover" />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-orange-500 px-2.5 py-1 text-xs font-medium text-white shadow">
              <CheckCircle className="h-3.5 w-3.5" />
              Enviado
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="absolute bottom-3 right-3 bg-white/90 text-black hover:bg-white"
              onClick={onPick}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Trocar"}
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onPick}
            disabled={uploading}
            className="group flex w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-muted/30 py-8 transition-colors hover:border-orange-500 hover:bg-orange-500/5 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {uploading ? (
              <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            ) : (
              <>
                <span className="rounded-full bg-orange-500/10 p-3 transition-colors group-hover:bg-orange-500/20">
                  <Camera className="h-6 w-6 text-orange-500" />
                </span>
                <span className="text-sm font-medium text-foreground">{actionLabel}</span>
                <span className="text-xs text-muted-foreground">Formatos aceitos: JPG, PNG, WEBP</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
