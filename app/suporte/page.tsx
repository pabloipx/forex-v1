import type { Metadata } from "next"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
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
      <SupportCenter />
    </div>
  )
}
