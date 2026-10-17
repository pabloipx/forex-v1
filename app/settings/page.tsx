import type { Metadata } from "next"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { TERM_THEME_COOKIE, parseTermTheme } from "@/lib/futures/term-theme"
import { SettingsView } from "@/components/settings/settings-view"

export const metadata: Metadata = {
  title: "Configurações | Kryptobit",
  description: "Gerencie seu perfil, senha, preferências e segurança da conta.",
}

export default async function SettingsPage() {
  const [supabase, cookieStore] = await Promise.all([createClient(), cookies()])
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, full_name, phone, avatar_url")
    .eq("id", user.id)
    .single()

  return (
    <SettingsView
      initialTheme={parseTermTheme(cookieStore.get(TERM_THEME_COOKIE)?.value)}
      profile={{
        id: user.id,
        email: profile?.email ?? user.email ?? "",
        full_name: profile?.full_name ?? null,
        phone: profile?.phone ?? null,
        avatar_url: profile?.avatar_url ?? null,
      }}
    />
  )
}
