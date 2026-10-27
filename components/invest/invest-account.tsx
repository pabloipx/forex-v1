"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BadgeCheck,
  ChevronDown,
  Eye,
  EyeOff,
  History,
  LogOut,
  ShieldAlert,
  User,
  Wallet,
  type LucideIcon,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { createClient } from "@/lib/supabase/client"
import { useFuturesState } from "@/hooks/use-futures"
import { cn } from "@/lib/utils"
import { useCountUp } from "./use-count-up"

interface Profile {
  full_name: string | null
  nickname: string | null
  email: string
  kyc_status: string
  is_verified: boolean
}

const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: "no-store" })
  if (!res.ok) return null
  return res.json()
}

const usd = (n: number) => n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/deposit", label: "Depositar", icon: ArrowDownToLine },
  { href: "/withdraw", label: "Sacar", icon: ArrowUpFromLine },
  { href: "/transactions", label: "Transações", icon: History },
  { href: "/profile", label: "Meu perfil", icon: User },
]

const itemClass =
  "min-h-11 cursor-pointer gap-3 rounded-lg px-3 text-sm text-iv-ink focus:bg-iv-line/60 focus:text-iv-ink [&_svg]:text-iv-sky"

function initialsOf(name: string) {
  const parts = name.trim().split(/[\s@._-]+/).filter(Boolean)
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?"
}

export function useInvestAccount() {
  const { state, isLoading } = useFuturesState("real")
  const authenticated = Boolean(state?.authenticated)
  const { data } = useSWR<{ profile: Profile } | null>(authenticated ? "/api/futures/profile" : null, fetcher, {
    revalidateOnFocus: false,
  })
  const profile = data?.profile
  const email = profile?.email || state?.email || ""
  const name = profile?.full_name || profile?.nickname || email.split("@")[0] || ""
  return {
    loading: isLoading && !state,
    authenticated,
    name,
    email,
    verified: Boolean(profile && (profile.is_verified || profile.kyc_status === "approved")),
    balance: state?.balances?.real ?? state?.balance ?? 0,
  }
}

export function BalancePill() {
  const { authenticated, balance } = useInvestAccount()
  const [hidden, setHidden] = useState(false)
  const shown = useCountUp(balance, 900)
  if (!authenticated) return null

  return (
    <div className="iv-rise flex min-w-0 items-center gap-2 rounded-xl border border-iv-line bg-iv-card px-3 py-1.5">
      <Wallet className="size-4 shrink-0 text-iv-sky" aria-hidden />
      <div className="flex min-w-0 flex-col leading-tight">
        <span className="text-[11px] uppercase tracking-wider text-iv-muted">Saldo real</span>
        <span className="truncate iv-num text-sm font-semibold tabular-nums text-iv-ink" aria-live="polite">
          {hidden ? "US$ ••••" : `US$ ${usd(shown)}`}
        </span>
      </div>
      <button
        type="button"
        onClick={() => setHidden((v) => !v)}
        aria-label={hidden ? "Mostrar saldo" : "Ocultar saldo"}
        className="-mr-2 flex size-9 shrink-0 items-center justify-center rounded-lg text-iv-muted transition-colors hover:text-iv-ink"
      >
        {hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  )
}

export function AccountMenu() {
  const router = useRouter()
  const { loading, authenticated, name, email, verified, balance } = useInvestAccount()
  const [signingOut, setSigningOut] = useState(false)

  if (loading) return <span className="size-11 shrink-0 animate-pulse rounded-full bg-iv-card" aria-hidden />

  if (!authenticated) {
    return (
      <Link
        href="/auth/login?next=/invest"
        className="flex h-11 shrink-0 items-center rounded-xl bg-iv-blue px-4 text-sm font-semibold text-iv-ink transition-transform active:scale-95"
      >
        Entrar
      </Link>
    )
  }

  const signOut = async () => {
    setSigningOut(true)
    await createClient().auth.signOut().catch(() => null)
    router.replace("/auth/login")
    router.refresh()
  }

  const initials = initialsOf(name || email)

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Abrir menu da conta"
          className="group flex shrink-0 items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-iv-sky"
        >
          <span className="relative flex size-11 items-center justify-center rounded-full bg-iv-blue text-sm font-bold text-iv-ink ring-2 ring-iv-blue/30 ring-offset-2 ring-offset-iv-bg transition-transform group-active:scale-95">
            {initials}
            {verified && (
              <span className="absolute -bottom-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-iv-bg">
                <BadgeCheck className="size-4 text-iv-up" aria-hidden />
              </span>
            )}
          </span>
          <span className="hidden flex-col items-start leading-tight md:flex">
            <span className="max-w-40 truncate text-sm font-medium text-iv-ink">{name}</span>
            <span className={cn("text-xs", verified ? "text-iv-up" : "text-iv-muted")}>
              {verified ? "Conta Verificada" : "Não verificada"}
            </span>
          </span>
          <ChevronDown
            className="hidden size-4 text-iv-muted transition-transform group-data-[state=open]:rotate-180 md:block"
            aria-hidden
          />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={10}
        className="w-72 rounded-2xl border-iv-line bg-iv-card p-2 text-iv-ink shadow-2xl shadow-iv-blue/10"
      >
        <div className="flex items-center gap-3 px-2 py-2">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-iv-blue text-sm font-bold text-iv-ink">
            {initials}
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold">{name}</span>
            <span className="truncate text-xs text-iv-muted">{email}</span>
            {verified ? (
              <span className="mt-0.5 flex items-center gap-1 text-xs text-iv-up">
                <BadgeCheck className="size-3.5" aria-hidden /> Conta Verificada
              </span>
            ) : (
              <Link href="/kyc" className="mt-0.5 flex items-center gap-1 text-xs text-iv-sky underline-offset-2 hover:underline">
                <ShieldAlert className="size-3.5" aria-hidden /> Verificar conta
              </Link>
            )}
          </div>
        </div>

        <div className="mx-1 my-1 rounded-xl border border-iv-line bg-iv-bg px-3 py-2.5">
          <span className="text-[11px] uppercase tracking-wider text-iv-muted">Saldo disponível</span>
          <p className="iv-num text-lg font-semibold tabular-nums">US$ {usd(balance)}</p>
        </div>

        <DropdownMenuSeparator className="bg-iv-line" />
        {LINKS.map(({ href, label, icon: Icon }) => (
          <DropdownMenuItem key={href} asChild className={itemClass}>
            <Link href={href}>
              <Icon className="size-4" aria-hidden />
              {label}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator className="bg-iv-line" />
        <DropdownMenuItem
          disabled={signingOut}
          onSelect={(e) => {
            e.preventDefault()
            signOut()
          }}
          className={cn(itemClass, "text-lp-down focus:bg-lp-down/10 focus:text-lp-down [&_svg]:text-lp-down")}
        >
          <LogOut className="size-4" aria-hidden />
          {signingOut ? "Saindo..." : "Sair"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
