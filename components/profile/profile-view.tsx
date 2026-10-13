"use client"

import { useState } from "react"
import Link from "next/link"
import { Toaster } from "sonner"
import { BadgeCheck, ChevronLeft, LayoutGrid, SlidersHorizontal, UserRound, KeyRound } from "lucide-react"
import { cn } from "@/lib/utils"
import { useProfile } from "./use-profile"
import { OverviewTab } from "./overview-tab"
import { PersonalTab } from "./personal-tab"
import { PreferencesTab } from "./preferences-tab"
import { SecurityTab } from "./security-tab"

const TABS = [
  { id: "overview", label: "Visão geral", icon: LayoutGrid },
  { id: "personal", label: "Dados pessoais", icon: UserRound },
  { id: "prefs", label: "Preferências", icon: SlidersHorizontal },
  { id: "security", label: "Segurança", icon: KeyRound },
] as const

type TabId = (typeof TABS)[number]["id"]

export function ProfileView() {
  const { profile, unauthorized, error, isLoading, save } = useProfile()
  const [tab, setTab] = useState<TabId>("overview")

  const name = profile?.nickname || profile?.full_name || profile?.email?.split("@")[0] || ""
  const initials = name.slice(0, 2).toUpperCase()

  return (
    <div className="min-h-dvh bg-term-bg text-term-text">
      <header className="flex h-12 items-center justify-between border-b border-term-line px-4">
        <Link href="/futures" className="flex items-center gap-1 text-sm text-term-muted hover:text-term-text">
          <ChevronLeft className="size-4" aria-hidden /> Voltar ao terminal
        </Link>
        <span className="text-lg font-extrabold tracking-tight">
          URYN<span className="text-primary">.</span>
        </span>
      </header>

      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6">
        {isLoading && <p className="text-sm text-term-muted">Carregando perfil...</p>}
        {unauthorized && (
          <div className="flex flex-col items-center gap-3 rounded-md border border-term-line bg-term-panel p-10 text-center">
            <p className="text-sm text-term-muted">Faça login para acessar seu perfil.</p>
            <Link href="/auth/login" className="rounded bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground">
              Entrar
            </Link>
          </div>
        )}
        {error && !unauthorized && <p className="text-sm text-short">{(error as Error).message}</p>}

        {profile && (
          <>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex size-14 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground" aria-hidden>
                {initials}
              </div>
              <div className="flex min-w-0 flex-col gap-0.5">
                <h1 className="flex items-center gap-2 text-xl font-semibold">
                  <span className="truncate">{profile.full_name || name}</span>
                  {profile.kyc_status === "approved" && <BadgeCheck className="size-5 text-long" aria-label="Verificado" />}
                </h1>
                <p className="truncate text-sm text-term-muted">
                  {profile.email}
                  {profile.testMode && " · modo teste"}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-6 md:flex-row">
              <nav aria-label="Seções do perfil" className="flex shrink-0 gap-1 overflow-x-auto md:w-52 md:flex-col">
                {TABS.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTab(id)}
                    aria-current={tab === id ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2 whitespace-nowrap rounded px-3 py-2 text-left text-sm",
                      tab === id ? "bg-term-panel font-semibold text-term-text" : "text-term-muted hover:text-term-text",
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                    {label}
                  </button>
                ))}
              </nav>
              <div className="min-w-0 flex-1">
                {tab === "overview" && <OverviewTab profile={profile} />}
                {tab === "personal" && <PersonalTab key={profile.id} profile={profile} onSave={save} />}
                {tab === "prefs" && <PreferencesTab prefs={profile.preferences} onSave={save} />}
                {tab === "security" && <SecurityTab profile={profile} />}
              </div>
            </div>
          </>
        )}
      </main>
      <Toaster theme="dark" position="top-center" richColors />
    </div>
  )
}
