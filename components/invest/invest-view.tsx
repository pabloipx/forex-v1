"use client"

import Image from "next/image"
import useSWR from "swr"
import { Toaster } from "sonner"
import { Headset, ShieldCheck, Zap } from "lucide-react"
import { useFuturesState } from "@/hooks/use-futures"
import type { InvestmentView } from "@/lib/invest-schedule"
import { InvestHeader, InvestHero } from "./invest-header"
import { InvestSimulator } from "./invest-simulator"
import { MyInvestments, TrustCard } from "./my-investments"

const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: "no-store" })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

const FEATURES = [
  { icon: ShieldCheck, title: "Plataforma segura", text: "Com criptografia de nível global." },
  { icon: Headset, title: "Suporte 24/7", text: "Estamos sempre por perto." },
  { icon: Zap, title: "Rendimentos mensais", text: "Receba todo dia 30." },
]

export function InvestView() {
  const { data, isLoading } = useSWR<{ authenticated: boolean; investments: InvestmentView[] }>(
    "/api/invest",
    fetcher,
    { refreshInterval: 30000 },
  )
  const { state } = useFuturesState("real")
  const authenticated = Boolean(data?.authenticated)

  return (
    <div className="min-h-dvh bg-iv-bg font-sans text-iv-ink">
      <Toaster theme="dark" position="top-center" richColors />
      <InvestHeader />
      <main>
        <InvestHero />
        <div className="mx-auto grid max-w-6xl gap-5 px-4 pb-10 pt-2 lg:grid-cols-[1.1fr_1fr]">
          <InvestSimulator
            authenticated={authenticated}
            balance={state?.authenticated ? (state.balance ?? 0) : undefined}
          />
          <div className="flex flex-col gap-5">
            <MyInvestments investments={data?.investments ?? []} loading={isLoading} />
            <TrustCard />
          </div>
        </div>
      </main>
      <footer className="border-t border-iv-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-4 py-6 md:flex-row md:items-center md:justify-between">
          <ul className="grid gap-4 sm:grid-cols-3 md:flex-1">
            {FEATURES.map(({ icon: Icon, title, text }, i) => (
              <li
                key={title}
                className="iv-rise flex items-center gap-3"
                style={{ animationDelay: `${640 + i * 90}ms` }}
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-iv-line bg-iv-card">
                  <Icon className="size-5 text-iv-sky" aria-hidden />
                </span>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-iv-ink">{title}</span>
                  <span className="text-xs text-iv-muted">{text}</span>
                </div>
              </li>
            ))}
          </ul>
          <Image
            src="/images/kryptobit-logo.png"
            alt="Kryptobit"
            width={180}
            height={48}
            className="h-10 w-auto self-center object-contain"
          />
        </div>
      </footer>
    </div>
  )
}
