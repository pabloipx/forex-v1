"use client"

import { useEffect } from "react"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[v0] Erro global da aplicacao:", error)
  }, [error])

  return (
    <html lang="pt-BR" className="bg-background">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1.5rem",
          padding: "0 1.5rem",
          textAlign: "center",
          backgroundColor: "#0a0f18",
          color: "#ffffff",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700, margin: 0 }}>Algo deu errado</h1>
        <p style={{ fontSize: "0.875rem", maxWidth: "24rem", color: "#9ca3af", lineHeight: 1.5, margin: 0 }}>
          Ocorreu um erro inesperado. Tente novamente.
        </p>
        <button
          onClick={reset}
          style={{
            minHeight: "44px",
            padding: "0 1.25rem",
            borderRadius: "0.75rem",
            border: "none",
            backgroundColor: "#22c55e",
            color: "#03130a",
            fontSize: "0.875rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Tentar novamente
        </button>
      </body>
    </html>
  )
}
