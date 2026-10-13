"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import useSWR from "swr"
import { Toaster } from "sonner"
import { BarChart3, CandlestickChart, LogOut, ShieldCheck, SlidersHorizontal, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { OverviewSection } from "./overview-section"
import { MarketsSection } from "./markets-section"
import { PositionsSection } from "./positions-section"
import { UsersSection } from "./users-section"
import { KycSection } from "./kyc-section"

const SECTIONS = [
  { id: "overview", label: "Visão geral", icon: BarChart3, Component: OverviewSection },
  { id: "positions", label: "Posições e ordens", icon: CandlestickChart, Component: PositionsSection },
  { id: "markets", label: "Mercados", icon: SlidersHorizontal, Component: MarketsSection },
  { id: "users", label: "Usuários e saldos", icon: Users, Component: UsersSection },
  { id: "kyc", label: "KYC", icon: ShieldCheck, Component: KycSection },
] as const

type SectionId = (typeof SECTIONS)[number]["id"]

const sessionFetcher = (url: string) => fetch(url, { cache: "no-store" }).then((r) => r.json() as Promise<{ authenticated: boolean }>)

export function ForexAdmin() {
  const { data: session } = useSWR("/api/admin/session", sessionFetcher, { revalidateOnFocus: true })
  const [section, setSection] = useState<SectionId>("overview")

  useEffect(() => {
    const fromHash = window.location.hash.slice(1) as SectionId
    if (SECTIONS.some((s) => s.id === fromHash)) setSection(fromHash)
  }, [])

  useEffect(() => {
    if (session && !session.authenticated) window.location.replace("/admin001")
  }, [session])

  const go = (id: SectionId) => {
    setSection(id)
    history.replaceState(null, "", `#${id}`)
  }

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" })
    window.location.replace("/admin001")
  }

  if (!session?.authenticated) {
    return <div className="flex min-h-dvh items-center justify-center bg-term-bg text-sm text-term-muted">Verificando sessão...</div>
  }

  const Active = SECTIONS.find((s) => s.id === section)!.Component
  const activeLabel = SECTIONS.find((s) => s.id === section)!.label

  return (
    <div className="flex min-h-dvh bg-term-bg font-sans text-term-text">
      <aside className="sticky top-0 hidden h-dvh w-56 shrink-0 flex-col border-r border-term-line bg-term-panel md:flex">
        <div className="flex h-14 items-center gap-1 border-b border-term-line px-5 text-lg font-extrabold tracking-tight">
          Profit Trading Global<span className="text-primary">.</span>
          <span className="ml-2 rounded bg-term-line px-1.5 py-0.5 text-[10px] font-medium text-term-muted">ADMIN</span>
        </div>
        <nav aria-label="Seções do painel" className="flex flex-1 flex-col gap-0.5 p-3">
          {SECTIONS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => go(id)}
              aria-current={section === id ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors",
                section === id ? "bg-term-line text-term-text" : "text-term-muted hover:bg-term-line/50 hover:text-term-text",
              )}
            >
              <Icon className={cn("size-4", section === id && "text-primary")} aria-hidden="true" />
              {label}
            </button>
          ))}
        </nav>
        <div className="flex flex-col gap-1 border-t border-term-line p-3">
          <Link href="/futures" className="rounded-md px-3 py-2 text-sm text-term-muted hover:bg-term-line/50 hover:text-term-text">
            Abrir terminal
          </Link>
          <button onClick={logout} className="flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm text-term-muted hover:bg-term-line/50 hover:text-short">
            <LogOut className="size-4" aria-hidden="true" />
            Sair
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-3 border-b border-term-line bg-term-bg/95 px-4 backdrop-blur md:px-6">
          <h1 className="text-base font-semibold">{activeLabel}</h1>
          <span className="flex items-center gap-1.5 text-xs text-term-muted">
            <span className="size-1.5 animate-pulse rounded-full bg-long" aria-hidden="true" />
            Atualização em tempo real
          </span>
        </header>
        <nav aria-label="Seções do painel" className="flex gap-1 overflow-x-auto border-b border-term-line px-3 py-2 md:hidden">
          {SECTIONS.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => go(id)}
              aria-current={section === id ? "page" : undefined}
              className={cn("shrink-0 rounded px-3 py-1.5 text-xs", section === id ? "bg-term-line text-term-text" : "text-term-muted")}
            >
              {label}
            </button>
          ))}
          <button onClick={logout} className="shrink-0 rounded px-3 py-1.5 text-xs text-short">
            Sair
          </button>
        </nav>
        <main className="flex-1 p-4 md:p-6">
          <Active />
        </main>
      </div>
      <Toaster theme="dark" position="top-right" />
    </div>
  )
}
