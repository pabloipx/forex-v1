"use client"

import Link from "next/link"
import { ChevronDown, Wallet, UserRound } from "lucide-react"
import { cn } from "@/lib/utils"
import type { AccountMode } from "@/lib/futures/types"
import { formatUsd } from "@/lib/futures/markets"

interface TopNavProps {
  account: AccountMode
  onAccountChange: (a: AccountMode) => void
  authenticated: boolean
  email?: string
  balances: { real: number; demo: number }
}

const links = [
  { href: "/", label: "Início" },
  { href: "/futures", label: "Derivativos", active: true },
  { href: "/trade", label: "Opções Binárias" },
  { href: "/historico", label: "Histórico" },
  { href: "/afiliados", label: "Afiliados" },
]

export function TopNav({ account, onAccountChange, authenticated, email, balances }: TopNavProps) {
  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-4 border-b border-term-line bg-term-bg px-3 lg:px-4">
      <div className="flex min-w-0 items-center gap-6">
        <Link href="/" className="flex items-center gap-1 text-lg font-extrabold tracking-tight text-term-text">
          URYN<span className="text-primary">.</span>
        </Link>
        <nav aria-label="Principal" className="hidden items-center gap-5 md:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={l.active ? "page" : undefined}
              className={cn(
                "relative flex h-12 items-center text-sm font-medium transition-colors",
                l.active ? "text-primary" : "text-term-text hover:text-primary",
              )}
            >
              {l.label}
              {l.active && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-primary" />}
            </Link>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-2 lg:gap-3">
        <div role="radiogroup" aria-label="Tipo de conta" className="flex rounded-md bg-term-panel p-0.5 text-xs">
          {(["real", "demo"] as const).map((a) => (
            <button
              key={a}
              role="radio"
              aria-checked={account === a}
              onClick={() => onAccountChange(a)}
              className={cn(
                "rounded px-2.5 py-1 font-semibold transition-colors",
                account === a ? "bg-term-line text-term-text" : "text-term-muted hover:text-term-text",
              )}
            >
              {a === "real" ? "Real" : "Demo"}
            </button>
          ))}
        </div>

        {authenticated ? (
          <>
            <div className="hidden flex-col items-end leading-tight sm:flex">
              <span className="text-[11px] text-term-muted">{account === "real" ? "Saldo real" : "Saldo demo"}</span>
              <span className="font-mono text-sm font-semibold text-term-text">
                {formatUsd(account === "real" ? balances.real : balances.demo)} USD
              </span>
            </div>
            <Link
              href="/deposit"
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
            >
              <Wallet className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">Depositar</span>
            </Link>
            <Link
              href="/profile"
              className="flex items-center gap-1 rounded-md p-1.5 text-term-muted hover:text-term-text"
              title={email}
            >
              <UserRound className="size-5" aria-hidden="true" />
              <ChevronDown className="hidden size-3 sm:block" aria-hidden="true" />
              <span className="sr-only">Perfil</span>
            </Link>
          </>
        ) : (
          <>
            <Link href="/auth/login" className="px-2 text-sm font-medium text-term-text hover:text-primary">
              Entrar
            </Link>
            <Link
              href="/auth/sign-up"
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground hover:opacity-90"
            >
              Cadastrar
            </Link>
          </>
        )}
      </div>
    </header>
  )
}
