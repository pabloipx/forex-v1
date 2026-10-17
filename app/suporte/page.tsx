import type { Metadata } from "next"
import Link from "next/link"
import { cookies } from "next/headers"
import { ChevronLeft, LifeBuoy } from "lucide-react"
import { TERM_THEME_COOKIE, parseTermTheme } from "@/lib/futures/term-theme"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Suporte | Kryptobit",
  description: "Central de suporte da Kryptobit.",
}

export default async function SupportPage() {
  const theme = parseTermTheme((await cookies()).get(TERM_THEME_COOKIE)?.value)

  return (
    <div className={cn("flex min-h-dvh flex-col bg-term-bg font-sans text-term-text", theme === "light" ? "term-light" : "term-dark")}>
      <header className="border-b border-term-line bg-term-panel">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-2 px-4">
          <Link
            href="/futures"
            aria-label="Voltar"
            className="-ml-2 flex size-9 items-center justify-center rounded-full text-term-muted transition-colors hover:bg-term-line hover:text-term-text"
          >
            <ChevronLeft className="size-5" aria-hidden="true" />
          </Link>
          <h1 className="text-base font-semibold">Suporte</h1>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-3 px-4 text-center">
        <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
          <LifeBuoy className="size-5" aria-hidden="true" />
        </span>
        <h2 className="text-lg font-semibold text-balance">Atendimento em breve</h2>
        <p className="max-w-sm text-sm leading-relaxed text-term-muted text-pretty">
          Estamos preparando um novo canal de suporte. Enquanto isso, acompanhe suas operações pelo terminal.
        </p>
      </main>
    </div>
  )
}
