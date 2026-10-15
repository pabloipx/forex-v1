"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ChevronDown, Globe, Menu, X } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

const NAV = [
  { href: "#mercados", label: "Mercados" },
  { href: "/futures", label: "Trade" },
  { href: "#ganhe", label: "Ganhe" },
  { href: "#institucional", label: "Institucional" },
]

const MORE = [
  { href: "/deposit", label: "Depositar" },
  { href: "/withdraw", label: "Sacar" },
  { href: "/transactions", label: "Transações" },
  { href: "/kyc", label: "Verificação" },
]

export function KbHeader() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-colors duration-300",
        scrolled || open ? "border-b border-lp-line bg-lp-bg/90 backdrop-blur-md" : "bg-transparent",
      )}
    >
      <div className="mx-auto flex h-19 max-w-7xl items-center justify-between gap-6 px-6">
        <div className="flex items-center gap-10">
          <Link href="/" aria-label="Kryptobit — página inicial" className="shrink-0">
            <img src="/images/kryptobit-logo-dark.png" alt="Kryptobit" width={1525} height={493} className="h-9 w-auto" />
          </Link>
          <nav aria-label="Navegação principal" className="hidden items-center gap-8 lg:flex">
            {NAV.map((n) => (
              <Link
                key={n.label}
                href={n.href}
                className="text-[15px] font-medium text-lp-ink/80 transition-colors hover:text-lp-primary"
              >
                {n.label}
              </Link>
            ))}
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1 text-[15px] font-medium text-lp-ink/80 outline-none transition-colors hover:text-lp-primary">
                Mais <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="border-lp-line bg-lp-bg text-lp-ink">
                {MORE.map((m) => (
                  <DropdownMenuItem key={m.href} asChild className="cursor-pointer focus:bg-lp-soft focus:text-lp-primary">
                    <Link href={m.href}>{m.label}</Link>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/auth/login"
            className="hidden rounded-lg bg-lp-bg px-5 py-2.5 text-[15px] font-semibold text-lp-ink shadow-sm ring-1 ring-lp-line transition-colors hover:bg-lp-soft sm:inline-flex"
          >
            Entrar
          </Link>
          <Link
            href="/auth/sign-up"
            className="hidden rounded-lg bg-lp-primary px-5 py-2.5 text-[15px] font-semibold text-lp-bg shadow-md shadow-lp-primary/25 transition-colors hover:bg-lp-navy sm:inline-flex"
          >
            Criar conta
          </Link>
          <button type="button" aria-label="Idioma: Português" className="hidden p-2 text-lp-ink sm:inline-flex">
            <Globe className="h-5 w-5" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="inline-flex p-2 text-lp-ink lg:hidden"
            aria-label={open ? "Fechar menu" : "Abrir menu"}
            aria-expanded={open}
            aria-controls="kb-mobile-menu"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="h-6 w-6" aria-hidden="true" /> : <Menu className="h-6 w-6" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {open && (
        <div id="kb-mobile-menu" className="border-t border-lp-line bg-lp-bg px-6 pb-6 lg:hidden">
          <nav aria-label="Navegação mobile" className="flex flex-col py-2">
            {[...NAV, ...MORE].map((n) => (
              <Link
                key={n.label}
                href={n.href}
                onClick={() => setOpen(false)}
                className="border-b border-lp-line py-3.5 text-base font-medium text-lp-ink"
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Link href="/auth/login" className="rounded-lg py-3 text-center font-semibold text-lp-ink ring-1 ring-lp-line">
              Entrar
            </Link>
            <Link href="/auth/sign-up" className="rounded-lg bg-lp-primary py-3 text-center font-semibold text-lp-bg">
              Criar conta
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
