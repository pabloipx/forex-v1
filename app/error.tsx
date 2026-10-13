"use client"

import { useEffect } from "react"
import { AlertTriangle, RotateCw } from "lucide-react"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[v0] Erro na aplicacao:", error)
  }, [error])

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 bg-background px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-destructive/30 bg-destructive/10">
        <AlertTriangle className="h-8 w-8 text-destructive" />
      </div>
      <div className="space-y-2">
        <h1 className="text-xl font-bold text-foreground text-balance">Algo deu errado</h1>
        <p className="max-w-sm text-sm leading-relaxed text-muted-foreground text-pretty">
          Ocorreu um erro inesperado ao carregar esta página. Tente novamente.
        </p>
      </div>
      <button
        onClick={reset}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
      >
        <RotateCw className="h-4 w-4" />
        Tentar novamente
      </button>
    </div>
  )
}
