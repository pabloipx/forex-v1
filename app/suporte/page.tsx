import type { Metadata } from "next"
import Link from "next/link"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { TERM_THEME_COOKIE, parseTermTheme } from "@/lib/futures/term-theme"
import { createClient } from "@/lib/supabase/server"
import { SupportCenter } from "@/components/support/support-center"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Suporte | Kryptobit",
  description: "Central de suporte da Kryptobit.",
}

export default async function SupportPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login?next=/suporte")

  const theme = parseTermTheme((await cookies()).get(TERM_THEME_COOKIE)?.value)

  return (
    <div className={cn("flex h-dvh flex-col bg-term-bg font-sans text-term-text", theme === "light" ? "term-light" : "term-dark")}>
      <header className="shrink-0 border-b border-term-line bg-term-panel">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-4">
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
      <SupportCenter />
    </div>
  )
}
