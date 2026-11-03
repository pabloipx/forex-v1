"use client"

import Link from "next/link"
import { memo } from "react"
import { ChartNoAxesColumnIncreasing, CircleHelp } from "lucide-react"
import type { InvestmentView } from "@/lib/invest-schedule"
import { cn } from "@/lib/utils"
import { AccountMenu } from "../invest-account"
import { Notifications } from "./notifications"

export const PORTFOLIO_TABS = [
  { id: "visao-geral", label: "Visão Geral" },
  { id: "rentabilidade", label: "Rentabilidade" },
  { id: "ativos", label: "Ativos" },
  { id: "extrato", label: "Extrato" },
  { id: "relatorios", label: "Relatórios" },
] as const

export type PortfolioTab = (typeof PORTFOLIO_TABS)[number]["id"]

export const PortfolioNav = memo(function PortfolioNav({
  active,
  onSelect,
  investments,
}: {
  active: PortfolioTab
  onSelect: (tab: PortfolioTab) => void
  investments: InvestmentView[]
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-iv-line/70 bg-iv-bg/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-1 px-4 pt-3 lg:flex-row lg:items-center lg:gap-10 lg:px-6 lg:py-0">
        <div className="flex items-center gap-3 lg:py-3">
          <Link href="/futures" aria-label="Voltar ao terminal" className="flex min-w-0 flex-1 items-center gap-2.5 lg:gap-3">
            <ChartNoAxesColumnIncreasing className="size-8 shrink-0 text-iv-sky lg:size-9" strokeWidth={2.6} aria-hidden />
            <span className="flex min-w-0 flex-col text-base font-bold leading-tight tracking-tight text-iv-ink sm:flex-row sm:gap-1.5 lg:text-xl">
              <span>Carteira de</span>
              <span>Investimentos</span>
            </span>
          </Link>
          <div className="flex items-center gap-1 lg:hidden">
            <HeaderActions investments={investments} />
          </div>
        </div>

        <nav aria-label="Seções da carteira" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:flex-1 lg:px-0">
          <ul className="flex gap-6 lg:gap-10">
            {PORTFOLIO_TABS.map((tab) => {
              const current = tab.id === active
              return (
                <li key={tab.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(tab.id)}
                    aria-current={current ? "page" : undefined}
                    className={cn(
                      "relative flex h-12 items-center whitespace-nowrap text-[15px] font-medium transition-colors lg:h-16 lg:text-base",
                      current ? "text-iv-ink" : "text-iv-muted hover:text-iv-ink",
                    )}
                  >
                    {tab.label}
                    <span
                      aria-hidden
                      className={cn(
                        "absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-iv-sky transition-opacity",
                        current ? "opacity-100" : "opacity-0",
                      )}
                    />
                  </button>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <HeaderActions investments={investments} />
        </div>
      </div>
    </header>
  )
})

function HeaderActions({ investments }: { investments: InvestmentView[] }) {
  return (
    <>
      <Notifications investments={investments} />
      <Link
        href="/suporte"
        aria-label="Ajuda e suporte"
        className="flex size-10 items-center justify-center rounded-full text-iv-ink/90 transition-colors hover:bg-iv-card hover:text-iv-ink lg:size-11"
      >
        <CircleHelp className="size-5 lg:size-6" />
      </Link>
      <AccountMenu />
    </>
  )
}
