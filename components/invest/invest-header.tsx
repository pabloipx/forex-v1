"use client"

import Image from "next/image"
import Link from "next/link"
import useSWR from "swr"
import { ArrowLeft, Bell, BadgeCheck, UserRound } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTickers } from "@/hooks/use-futures"

const COINS = [
  { symbol: "BTCUSDT", label: "BTC", icon: "₿", color: "bg-[#f7931a]" },
  { symbol: "ETHUSDT", label: "ETH", icon: "Ξ", color: "bg-[#627eea]" },
  { symbol: "SOLUSDT", label: "SOL", icon: "◎", color: "bg-[#14f195] text-iv-bg" },
]

const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: "no-store" })
  if (!res.ok) return null
  return res.json()
}

interface Profile {
  full_name: string | null
  nickname: string | null
  kyc_status: string
  is_verified: boolean
}

export function InvestHeader() {
  const tickers = useTickers()
  const { data } = useSWR<{ profile: Profile } | null>("/api/futures/profile", fetcher)
  const profile = data?.profile
  const verified = profile && (profile.is_verified || profile.kyc_status === "approved")
  const name = profile?.full_name || profile?.nickname

  return (
    <header className="sticky top-0 z-30 border-b border-iv-line bg-iv-bg/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
        <Link
          href="/futures"
          aria-label="Voltar ao terminal"
          className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-iv-line text-iv-muted transition-colors hover:text-iv-ink"
        >
          <ArrowLeft className="size-5" />
        </Link>

        <ul className="no-scrollbar flex min-w-0 flex-1 gap-2 overflow-x-auto" aria-label="Cotações">
          {COINS.map((c, i) => {
            const t = tickers[c.symbol]
            const up = (t?.changePercent ?? 0) >= 0
            return (
              <li
                key={c.symbol}
                className="iv-rise flex shrink-0 items-center gap-2 rounded-xl border border-iv-line bg-iv-card px-3 py-2"
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <span
                  aria-hidden
                  className={cn("flex size-6 items-center justify-center rounded-full text-xs font-bold text-iv-ink", c.color)}
                >
                  {c.icon}
                </span>
                <span className="text-sm font-semibold text-iv-ink">{c.label}</span>
                <span className="font-mono text-sm tabular-nums text-iv-ink">
                  {t ? `$${t.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                </span>
                {t && (
                  <span className={cn("font-mono text-xs tabular-nums", up ? "text-iv-up" : "text-lp-down")}>
                    {up ? "+" : ""}
                    {t.changePercent.toFixed(2)}%
                  </span>
                )}
              </li>
            )
          })}
        </ul>

        <button
          type="button"
          aria-label="Notificações"
          className="hidden size-11 shrink-0 items-center justify-center rounded-xl text-iv-muted transition-colors hover:text-iv-ink sm:flex"
        >
          <Bell className="size-5" />
        </button>

        <div className="flex shrink-0 items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-iv-blue text-iv-ink">
            <UserRound className="size-5" aria-hidden />
          </span>
          {name && (
            <div className="hidden flex-col md:flex">
              <span className="text-sm font-medium text-iv-ink">{name}</span>
              {verified && (
                <span className="flex items-center gap-1 text-xs text-iv-up">
                  Conta Verificada <BadgeCheck className="size-3.5" aria-hidden />
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

export function InvestHero() {
  return (
    <section className="relative overflow-hidden border-b border-iv-line">
      <Image
        src="/images/invest-bull.png"
        alt=""
        fill
        priority
        sizes="100vw"
        className="iv-bull object-cover object-[70%_center] opacity-60 md:object-right md:opacity-100"
      />
      <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-iv-bg via-iv-bg/80 to-iv-bg/10" />
      <div className="relative mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 py-10 md:py-14">
        <span
          className="iv-rise iv-shine relative overflow-hidden rounded-full bg-iv-blue px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-iv-ink"
          style={{ animationDelay: "100ms" }}
        >
          Renda Passiva
        </span>
        <h1
          className="iv-rise text-balance text-4xl font-bold leading-tight text-iv-ink md:text-5xl"
          style={{ animationDelay: "200ms" }}
        >
          Seu dinheiro
          <br />
          <span className="text-iv-ink/80">trabalhando </span>
          <span className="text-iv-sky">por você</span>
        </h1>
        <p
          className="iv-rise max-w-lg text-pretty text-base leading-relaxed text-iv-ink/85"
          style={{ animationDelay: "320ms" }}
        >
          Invista a partir de <strong className="text-iv-ink">US$ 500</strong> e receba rendimentos mensais com a
          segurança da Kryptobit. O valor investido fica aplicado por 3 meses, e você pode sacar os rendimentos todo
          mês.
        </p>
      </div>
    </section>
  )
}
