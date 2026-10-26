"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import useSWR from "swr"
import { Toaster } from "sonner"
import {
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart3,
  CandlestickChart,
  ExternalLink,
  Gauge,
  Headset,
  LogOut,
  Menu,
  Rocket,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  Zap,
} from "lucide-react"
import { AdminSupport } from "@/components/admin/sections/admin-support"
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"
import { OverviewSection } from "./overview-section"
import { MarketsSection } from "./markets-section"
import { PositionsSection } from "./positions-section"
import { UsersSection } from "./users-section"
import { KycSection } from "./kyc-section"
import { WithdrawalsSection } from "./withdrawals-section"
import { DepositsSection } from "./deposits-section"
import { ManipulationSection } from "./manipulation-section"
import { GatewaySection } from "./gateway-section"
import { LimitsSection } from "./limits-section"
import { LaunchesSection } from "./launches-section"

const SECTIONS = [
  { id: "overview", label: "Visão geral", group: "Painel", icon: BarChart3, Component: OverviewSection },
  { id: "positions", label: "Posições e ordens", group: "Painel", icon: CandlestickChart, Component: PositionsSection },
  { id: "markets", label: "Mercados", group: "Mercado", icon: SlidersHorizontal, Component: MarketsSection },
  { id: "launches", label: "Lançamentos", group: "Mercado", icon: Rocket, Component: LaunchesSection },
  { id: "manipulation", label: "Manipulação", group: "Mercado", icon: Zap, Component: ManipulationSection },
  { id: "users", label: "Usuários e saldos", group: "Clientes", icon: Users, Component: UsersSection },
  { id: "kyc", label: "KYC", group: "Clientes", icon: ShieldCheck, Component: KycSection },
  { id: "support", label: "Suporte", group: "Clientes", icon: Headset, Component: AdminSupport },
  { id: "deposits", label: "Depósitos", group: "Financeiro", icon: ArrowDownToLine, Component: DepositsSection },
  { id: "withdrawals", label: "Saques", group: "Financeiro", icon: ArrowUpFromLine, Component: WithdrawalsSection },
  { id: "limits", label: "Limites", group: "Financeiro", icon: Gauge, Component: LimitsSection },
  { id: "gateway", label: "Gateway", group: "Financeiro", icon: Activity, Component: GatewaySection },
] as const

type SectionId = (typeof SECTIONS)[number]["id"]

const GROUPS = Array.from(new Set(SECTIONS.map((s) => s.group)))

const sessionFetcher = (url: string) => fetch(url, { cache: "no-store" }).then((r) => r.json() as Promise<{ authenticated: boolean }>)

function Brand() {
  return (
    <div className="flex items-center gap-1 text-lg font-extrabold tracking-tight">
      Krypto<span className="text-adm-accent">bit</span>
      <span className="ml-2 rounded bg-term-line px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-term-muted">ADMIN</span>
    </div>
  )
}

function Credit({ className }: { className?: string }) {
  return (
    <p className={cn("text-[11px] text-term-muted/70", className)}>
      developed by <span className="font-medium text-term-muted">@nexgroupdigital</span>
    </p>
  )
}

function SidebarBody({ section, onSelect, onLogout }: { section: SectionId; onSelect: (id: SectionId) => void; onLogout: () => void }) {
  return (
    <>
      <nav aria-label="Seções do painel" className="flex flex-1 flex-col gap-5 overflow-y-auto p-3">
        {GROUPS.map((group) => (
          <div key={group} className="flex flex-col gap-0.5">
            <span className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-term-muted/70">{group}</span>
            {SECTIONS.filter((s) => s.group === group).map(({ id, label, icon: Icon }) => {
              const active = section === id
              return (
                <button
                  key={id}
                  onClick={() => onSelect(id)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-sm transition-colors md:py-2",
                    active ? "bg-primary/10 font-medium text-term-text" : "text-term-muted hover:bg-term-line/50 hover:text-term-text",
                  )}
                >
                  <Icon className={cn("size-4 shrink-0", active ? "text-primary" : "text-term-muted")} aria-hidden="true" />
                  {label}
                </button>
              )
            })}
          </div>
        ))}
      </nav>
      <div className="flex flex-col gap-1 border-t border-term-line p-3">
        <Link
          href="/futures"
          className="flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm text-term-muted hover:bg-term-line/50 hover:text-term-text md:py-2"
        >
          <ExternalLink className="size-4" aria-hidden="true" />
          Abrir terminal
        </Link>
        <button
          onClick={onLogout}
          className="flex items-center gap-2.5 rounded-md px-3 py-2.5 text-left text-sm text-term-muted hover:bg-short/10 hover:text-short md:py-2"
        >
          <LogOut className="size-4" aria-hidden="true" />
          Sair
        </button>
        <Credit className="px-3 pt-2" />
      </div>
    </>
  )
}

export function ForexAdmin() {
  const { data: session } = useSWR("/api/admin/session", sessionFetcher, { revalidateOnFocus: true })
  const [section, setSection] = useState<SectionId>("overview")
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const sync = () => {
      const fromHash = window.location.hash.slice(1) as SectionId
      if (SECTIONS.some((s) => s.id === fromHash)) setSection(fromHash)
    }
    sync()
    window.addEventListener("hashchange", sync)
    return () => window.removeEventListener("hashchange", sync)
  }, [])

  useEffect(() => {
    if (session && !session.authenticated) window.location.replace("/admin001")
  }, [session])

  const go = (id: SectionId) => {
    setSection(id)
    setMenuOpen(false)
    history.replaceState(null, "", `#${id}`)
    window.scrollTo({ top: 0 })
  }

  const logout = async () => {
    await fetch("/api/admin/logout", { method: "POST" })
    window.location.replace("/admin001")
  }

  if (!session?.authenticated) {
    return <div className="flex min-h-dvh items-center justify-center bg-term-bg text-sm text-term-muted">Verificando sessão...</div>
  }

  const active = SECTIONS.find((s) => s.id === section)!
  const Active = active.Component

  return (
    <div className="flex min-h-dvh bg-term-bg font-sans text-term-text">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-term-line bg-term-panel md:flex">
        <div className="flex h-14 items-center border-b border-term-line px-5">
          <Brand />
        </div>
        <SidebarBody section={section} onSelect={go} onLogout={logout} />
      </aside>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetContent side="left" className="flex w-72 flex-col gap-0 border-term-line bg-term-panel p-0 text-term-text">
          <div className="flex h-14 items-center border-b border-term-line px-5">
            <Brand />
          </div>
          <SheetTitle className="sr-only">Menu do painel</SheetTitle>
          <SheetDescription className="sr-only">Navegue entre as seções do painel administrativo</SheetDescription>
          <SidebarBody section={section} onSelect={go} onLogout={logout} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-term-line bg-term-bg/90 px-3 backdrop-blur md:px-6">
          <button
            onClick={() => setMenuOpen(true)}
            aria-label="Abrir menu"
            className="flex size-10 items-center justify-center rounded-md text-term-muted hover:bg-term-line/50 hover:text-term-text md:hidden"
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="text-[10px] font-medium uppercase tracking-wider text-term-muted md:hidden">{active.group}</span>
            <h1 className="truncate text-sm font-semibold md:text-base">{active.label}</h1>
          </div>
          <span className="flex items-center gap-1.5 text-xs text-term-muted">
            <span className="size-1.5 animate-pulse rounded-full bg-long" aria-hidden="true" />
            <span className="hidden sm:inline">Atualização em tempo real</span>
            <span className="sm:hidden">Ao vivo</span>
          </span>
        </header>

        <main className="flex-1 px-3 py-4 md:p-6">
          <div className="mx-auto w-full max-w-[1600px]">
            <Active />
          </div>
        </main>

        <footer className="flex items-center justify-center border-t border-term-line px-4 py-4">
          <Credit />
        </footer>
      </div>
      <Toaster theme="dark" position="top-center" />
    </div>
  )
}
