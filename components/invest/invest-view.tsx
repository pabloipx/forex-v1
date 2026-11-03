"use client"

import { memo, useCallback, useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import Link from "next/link"
import useSWR from "swr"
import { Toaster } from "sonner"
import { Info } from "lucide-react"
import { useFuturesState } from "@/hooks/use-futures"
import type { InvestmentView } from "@/lib/invest-schedule"
import { buildPortfolio } from "@/lib/invest-portfolio"
import { PortfolioNav, type PortfolioTab } from "./portfolio/portfolio-nav"
import { PatrimonyCard } from "./portfolio/patrimony-card"
import { PerformanceCard } from "./portfolio/performance-card"
import { CompositionTable } from "./portfolio/composition-table"
import { StatementSection } from "./portfolio/statement-section"
import { ReportsSection } from "./portfolio/reports-section"
import { ChartSkeleton } from "./portfolio/chart-skeleton"

const AllocationCard = memo(
  dynamic(() => import("./portfolio/allocation-card").then((m) => m.AllocationCard), {
    ssr: false,
    loading: () => <ChartSkeleton variant="donut" />,
  }),
)
const EvolutionChart = memo(
  dynamic(() => import("./portfolio/evolution-chart").then((m) => m.EvolutionChart), {
    ssr: false,
    loading: () => <ChartSkeleton variant="area" />,
  }),
)
const InvestDialog = dynamic(() => import("./portfolio/invest-dialog"), { ssr: false })
const loadInvestDialog = () => import("./portfolio/invest-dialog")

const MemoPatrimony = memo(PatrimonyCard)
const MemoPerformance = memo(PerformanceCard)
const MemoComposition = memo(CompositionTable)
const MemoStatement = memo(StatementSection)
const MemoReports = memo(ReportsSection)

const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: "no-store" })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

const EMPTY: InvestmentView[] = []

export function InvestView() {
  const { data, isLoading } = useSWR<{ authenticated: boolean; investments: InvestmentView[] }>("/api/invest", fetcher, {
    refreshInterval: 30000,
    keepPreviousData: true,
  })
  const { state } = useFuturesState("real")
  const authenticated = Boolean(data?.authenticated)
  const investments = data?.investments ?? EMPTY

  const [tab, setTab] = useState<PortfolioTab>("visao-geral")
  const [hidden, setHidden] = useState(false)
  const [investOpen, setInvestOpen] = useState(false)
  const [dialogMounted, setDialogMounted] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  // `now` only ticks once a minute; read the clock again so a just-made aporte counts as realized.
  const portfolio = useMemo(() => buildPortfolio(investments, Math.max(now, Date.now())), [investments, now])

  const openInvest = useCallback(() => {
    setDialogMounted(true)
    setInvestOpen(true)
  }, [])
  const toggleHidden = useCallback(() => setHidden((v) => !v), [])

  const select = useCallback((next: PortfolioTab) => {
    setTab(next)
    if (next === "visao-geral") window.scrollTo({ top: 0, behavior: "smooth" })
    else document.getElementById(next)?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [])

  return (
    <div className="min-h-dvh bg-iv-bg font-sans text-iv-ink">
      <Toaster theme="dark" position="top-center" richColors />
      <PortfolioNav active={tab} onSelect={select} investments={authenticated ? investments : EMPTY} />

      <main id="visao-geral" className="mx-auto flex max-w-[1440px] flex-col gap-5 px-4 py-5 lg:px-6 lg:py-6">
        <h1 className="sr-only">Carteira de Investimentos</h1>

        {!isLoading && portfolio.sample && (
          <div className="iv-rise flex flex-col gap-3 rounded-xl border border-iv-sky/30 bg-iv-blue/10 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-2 text-iv-ink/90">
              <Info className="mt-0.5 size-4 shrink-0 text-iv-sky" aria-hidden />
              <span>
                <strong className="font-semibold text-iv-ink">Exemplo de carteira com US$ 10.000.</strong> Os valores abaixo são uma
                simulação. Faça seu primeiro aporte para ver a sua carteira real.
              </span>
            </p>
            {authenticated ? (
              <button
                type="button"
                onClick={openInvest}
                onPointerEnter={loadInvestDialog}
                className="h-10 shrink-0 rounded-lg bg-iv-blue px-4 font-semibold text-iv-ink transition-transform active:scale-95"
              >
                Fazer primeiro aporte
              </button>
            ) : (
              <Link
                href="/auth/login?next=/invest"
                className="flex h-10 shrink-0 items-center justify-center rounded-lg bg-iv-blue px-4 font-semibold text-iv-ink"
              >
                Entrar para investir
              </Link>
            )}
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[minmax(300px,1fr)_minmax(0,2.15fr)_minmax(280px,0.9fr)]">
          <MemoPatrimony
            portfolio={portfolio}
            hidden={hidden}
            onToggleHidden={toggleHidden}
            onInvest={openInvest}
            onPrefetch={loadInvestDialog}
          />
          <AllocationCard portfolio={portfolio} hidden={hidden} />
          <MemoPerformance portfolio={portfolio} />
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <EvolutionChart portfolio={portfolio} hidden={hidden} />
          <MemoComposition portfolio={portfolio} hidden={hidden} />
        </div>

        {authenticated && (
          <div className="grid gap-5">
            <MemoStatement investments={investments} loading={isLoading} hidden={hidden} />
            <MemoReports investments={investments} hidden={hidden} />
          </div>
        )}
      </main>

      {dialogMounted && (
        <InvestDialog
          open={investOpen}
          onOpenChange={setInvestOpen}
          authenticated={authenticated}
          balance={state?.authenticated ? (state.balance ?? 0) : undefined}
        />
      )}
    </div>
  )
}
