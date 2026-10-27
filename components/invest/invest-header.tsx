"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, Bell } from "lucide-react"
import { cn } from "@/lib/utils"
import { useTickers } from "@/hooks/use-futures"
import { AccountMenu, BalancePill } from "./invest-account"

const COINS = [
  { symbol: "BTCUSDT", label: "BTC", icon: "₿", color: "bg-[#f7931a]" },
  { symbol: "ETHUSDT", label: "ETH", icon: "Ξ", color: "bg-[#627eea]" },
  { symbol: "SOLUSDT", label: "SOL", icon: "S", color: "bg-[#14f195] text-iv-bg" },
]

function formatPrice(n: number) {
  const digits = n >= 1000 ? 0 : 2
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

function TickerStrip() {
  const tickers = useTickers()
  return (
    <ul className="grid grid-cols-3 gap-2 md:flex md:flex-1" aria-label="Cotações">
      {COINS.map((c, i) => {
        const t = tickers[c.symbol]
        const up = (t?.changePercent ?? 0) >= 0
        return (
          <li
            key={c.symbol}
            className="iv-rise flex min-w-0 items-center gap-2 rounded-xl border border-iv-line bg-iv-card px-2.5 py-2 md:px-3"
            style={{ animationDelay: `${120 + i * 80}ms` }}
          >
            <span
              aria-hidden
              className={cn(
                "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-iv-ink",
                c.color,
              )}
            >
              {c.icon}
            </span>
            <div className="flex min-w-0 flex-col leading-tight md:flex-row md:items-center md:gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-iv-ink md:text-sm">{c.label}</span>
                {t && (
                  <span
                    className={cn("font-mono text-[11px] tabular-nums md:text-xs", up ? "text-iv-up" : "text-lp-down")}
                  >
                    {up ? "+" : ""}
                    {t.changePercent.toFixed(2)}%
                  </span>
                )}
              </div>
              <span className="truncate font-mono text-xs tabular-nums text-iv-muted md:text-sm md:text-iv-ink">
                {t ? `$${formatPrice(t.price)}` : "—"}
              </span>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export function InvestHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-iv-line bg-iv-bg/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center">
        <div className="flex items-center gap-2 md:contents">
          <Link
            href="/futures"
            aria-label="Voltar ao terminal"
            className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-iv-line text-iv-muted transition-colors hover:border-iv-blue hover:text-iv-ink md:order-first"
          >
            <ArrowLeft className="size-5" />
          </Link>
          <div className="flex min-w-0 flex-1 justify-start md:order-last md:flex-none">
            <BalancePill />
          </div>
          <button
            type="button"
            aria-label="Notificações"
            className="relative hidden size-11 shrink-0 items-center justify-center rounded-xl text-iv-muted transition-colors hover:text-iv-ink sm:flex md:order-last"
          >
            <Bell className="size-5" />
          </button>
          <div className="md:order-last">
            <AccountMenu />
          </div>
        </div>
        <TickerStrip />
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
