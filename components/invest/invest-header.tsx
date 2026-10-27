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
                    className={cn("iv-num text-[11px] tabular-nums md:text-xs", up ? "text-iv-up" : "text-lp-down")}
                  >
                    {up ? "+" : ""}
                    {t.changePercent.toFixed(2)}%
                  </span>
                )}
              </div>
              <span className="truncate iv-num text-xs tabular-nums text-iv-muted md:text-sm md:text-iv-ink">
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
      <div aria-hidden className="absolute inset-0 bg-gradient-to-r from-iv-bg via-iv-bg/85 to-iv-bg/10" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-iv-bg to-transparent" />
      <div className="relative mx-auto flex max-w-6xl flex-col items-start gap-5 px-5 pb-8 pt-10 md:pb-14 md:pt-16">
        <span
          className="iv-rise iv-shine iv-eyebrow relative flex items-center gap-2 overflow-hidden rounded-full border border-iv-sky/30 bg-iv-blue/15 px-3.5 py-1.5 text-iv-sky"
          style={{ animationDelay: "100ms" }}
        >
          <span className="iv-live size-1.5 rounded-full bg-iv-sky" aria-hidden />
          Renda Passiva
        </span>
        <h1
          className="iv-rise font-display text-balance text-[2.75rem] leading-[1.02] text-iv-ink md:text-7xl"
          style={{ animationDelay: "200ms" }}
        >
          Seu dinheiro
          <br />
          trabalhando <em className="text-iv-sky">por você</em>
        </h1>
        <div className="iv-rise iv-gold-rule" style={{ animationDelay: "280ms" }} aria-hidden />
        <p
          className="iv-rise max-w-md text-pretty text-[15px] leading-relaxed text-iv-ink/75"
          style={{ animationDelay: "320ms" }}
        >
          Invista a partir de <strong className="font-semibold text-iv-ink">US$ 500</strong> e receba rendimentos
          mensais com a segurança da Kryptobit. O valor fica aplicado por 3 meses e os rendimentos podem ser sacados
          todo mês.
        </p>
        <dl
          className="iv-rise mt-1 flex w-full max-w-md items-stretch rounded-2xl border border-iv-line/80 bg-iv-bg/60 backdrop-blur-md"
          style={{ animationDelay: "420ms" }}
        >
          {[
            { k: "Rendimento", v: "10%", s: "ao mês" },
            { k: "Prazo", v: "3", s: "meses" },
            { k: "Saque", v: "Dia 30", s: "todo mês" },
          ].map((item, i) => (
            <div
              key={item.k}
              className={`flex flex-1 flex-col gap-1 px-4 py-3 ${i > 0 ? "border-l border-iv-line/80" : ""}`}
            >
              <dt className="iv-eyebrow text-[10px] text-iv-muted">{item.k}</dt>
              <dd className="flex items-baseline gap-1">
                <span className="iv-num whitespace-nowrap text-lg font-semibold text-iv-ink">{item.v}</span>
                <span className="hidden text-xs text-iv-muted min-[380px]:inline">{i === 2 ? "" : item.s}</span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
