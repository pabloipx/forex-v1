"use client"

import Link from "next/link"
import { Moon, Sun, TrendingUp, Wallet } from "lucide-react"
import { UserMenu } from "./user-menu"
import { cn } from "@/lib/utils"
import type { AccountMode } from "@/lib/futures/types"
import { formatUsd } from "@/lib/futures/markets"
import type { TermTheme } from "@/lib/futures/term-theme"

interface TopNavProps {
  theme: TermTheme
  onToggleTheme: () => void
  account: AccountMode
  onAccountChange: (a: AccountMode) => void
  authenticated: boolean
  email?: string
  balances: { real: number; demo: number }
}

const links = [
  { href: "/futures", label: "Derivativos", active: true },
  { href: "/transactions", label: "Transações" },
  { href: "/withdraw", label: "Sacar" },
]

export function TopNav({ theme, onToggleTheme, account, onAccountChange, authenticated, email, balances }: TopNavProps) {
  const isLight = theme === "light"
  const initial = (email?.[0] ?? "U").toUpperCase()

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-term-line bg-term-bg px-3 lg:px-5">
      <div className="flex min-w-0 items-center gap-8">
        <Link href="/futures" className="flex items-center gap-2" aria-label="Kryptobit, início">
          <span
            aria-hidden="true"
            className="flex size-7 items-center justify-center rounded-lg bg-primary text-sm font-black text-primary-foreground"
          >
            K
          </span>
          <span className="text-lg font-extrabold tracking-tight text-term-text">
            Krypto<span className="text-primary">bit</span>
          </span>
        </Link>
        <nav aria-label="Principal" className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={l.active ? "page" : undefined}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                l.active ? "bg-primary/10 text-primary" : "text-term-muted hover:bg-term-panel hover:text-term-text",
              )}
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/invest"
            className="group ml-1 flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-3 py-1.5 text-sm font-semibold text-primary transition-colors hover:border-primary/60 hover:bg-primary/15"
          >
            <TrendingUp className="size-4 transition-transform group-hover:-translate-y-0.5" aria-hidden="true" />
            Renda Passiva
          </Link>
        </nav>
      </div>

      <div className="flex items-center gap-2 lg:gap-3">
        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={isLight ? "Ativar tema escuro" : "Ativar tema claro"}
          title={isLight ? "Tema escuro" : "Tema claro"}
          className="flex size-9 items-center justify-center rounded-full border border-term-line text-term-muted transition-colors hover:bg-term-panel hover:text-term-text"
        >
          {isLight ? <Moon className="size-4" aria-hidden="true" /> : <Sun className="size-4" aria-hidden="true" />}
        </button>

        <div role="radiogroup" aria-label="Tipo de conta" className="flex rounded-full border border-term-line p-0.5 text-xs">
          {(["real", "demo"] as const).map((a) => {
            const active = account === a
            return (
              <button
                key={a}
                role="radio"
                aria-checked={active}
                onClick={() => onAccountChange(a)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1 font-semibold transition-colors",
                  active ? "bg-term-panel text-term-text shadow-sm" : "text-term-muted hover:text-term-text",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "size-1.5 rounded-full",
                    active ? (a === "real" ? "bg-long" : "bg-primary") : "bg-term-muted/50",
                  )}
                />
                {a === "real" ? "Real" : "Demo"}
              </button>
            )
          })}
        </div>

        {authenticated ? (
          <>
            <div className="hidden h-9 items-center gap-3 rounded-full border border-term-line pl-4 pr-1 sm:flex">
              <div className="flex flex-col items-end leading-none">
                <span className="text-[10px] font-medium uppercase tracking-wide text-term-muted">
                  {account === "real" ? "Saldo" : "Saldo demo"}
                </span>
                <span className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-term-text">
                  {formatUsd(account === "real" ? balances.real : balances.demo)}
                  <span className="ml-1 text-[10px] font-medium text-term-muted">USD</span>
                </span>
              </div>
              <Link
                href="/deposit"
                className="flex h-7 items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                <Wallet className="size-3.5" aria-hidden="true" />
                Depositar
              </Link>
            </div>
            <Link
              href="/deposit"
              aria-label="Depositar"
              className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground sm:hidden"
            >
              <Wallet className="size-4" aria-hidden="true" />
            </Link>
            <UserMenu email={email} initial={initial} />
          </>
        ) : (
          <>
            <Link href="/auth/login" className="px-2 text-sm font-medium text-term-text hover:text-primary">
              Entrar
            </Link>
            <Link
              href="/auth/sign-up"
              className="rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Cadastrar
            </Link>
          </>
        )}
      </div>
    </header>
  )
}
