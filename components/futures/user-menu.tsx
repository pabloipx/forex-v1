"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronDown,
  History,
  LifeBuoy,
  LogOut,
  Settings,
  ShieldCheck,
  User,
  type LucideIcon,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"

interface UserMenuProps {
  email?: string
  initial: string
}

type MenuLink = { href: string; label: string; icon: LucideIcon }

const accountLinks: MenuLink[] = [
  { href: "/profile", label: "Meu perfil", icon: User },
  { href: "/kyc", label: "Verificação", icon: ShieldCheck },
  { href: "/settings", label: "Configurações", icon: Settings },
]

const walletLinks: MenuLink[] = [
  { href: "/deposit", label: "Depositar", icon: ArrowDownToLine },
  { href: "/withdraw", label: "Sacar", icon: ArrowUpFromLine },
  { href: "/transactions", label: "Transações", icon: History },
]

const itemClass =
  "cursor-pointer gap-2.5 rounded-md px-2.5 py-2 text-sm text-term-text focus:bg-term-line/60 focus:text-term-text [&_svg]:text-term-muted focus:[&_svg]:text-term-text"

function LinkGroup({ items }: { items: MenuLink[] }) {
  return (
    <DropdownMenuGroup>
      {items.map(({ href, label, icon: Icon }) => (
        <DropdownMenuItem key={href} asChild className={itemClass}>
          <Link href={href}>
            <Icon className="size-4" aria-hidden="true" />
            {label}
          </Link>
        </DropdownMenuItem>
      ))}
    </DropdownMenuGroup>
  )
}

export function UserMenu({ email, initial }: UserMenuProps) {
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)

  const signOut = async () => {
    setSigningOut(true)
    await createClient().auth.signOut().catch(() => null)
    router.replace("/auth/login")
    router.refresh()
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Abrir menu da conta"
          className="group flex items-center gap-1 rounded-full p-0.5 pr-1.5 text-term-muted outline-none transition-colors hover:bg-term-panel hover:text-term-text focus-visible:ring-2 focus-visible:ring-primary/50 data-[state=open]:bg-term-panel data-[state=open]:text-term-text"
        >
          <span
            aria-hidden="true"
            className="flex size-8 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary"
          >
            {initial}
          </span>
          <ChevronDown
            className="hidden size-3.5 transition-transform duration-200 group-data-[state=open]:rotate-180 sm:block"
            aria-hidden="true"
          />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-64 rounded-xl border-term-line bg-term-panel p-1.5 text-term-text shadow-xl"
      >
        <DropdownMenuLabel className="flex items-center gap-3 px-2.5 py-2 font-normal">
          <span
            aria-hidden="true"
            className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary"
          >
            {initial}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-sm font-semibold text-term-text">Minha conta</span>
            <span className="truncate text-xs text-term-muted">{email ?? "—"}</span>
          </span>
        </DropdownMenuLabel>

        <DropdownMenuSeparator className="bg-term-line" />
        <LinkGroup items={accountLinks} />
        <DropdownMenuSeparator className="bg-term-line" />
        <LinkGroup items={walletLinks} />
        <DropdownMenuSeparator className="bg-term-line" />

        <DropdownMenuItem asChild className={itemClass}>
          <Link href="/suporte">
            <LifeBuoy className="size-4" aria-hidden="true" />
            Suporte
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={signingOut}
          onSelect={(e) => {
            e.preventDefault()
            signOut()
          }}
          className={cn(itemClass, "text-short focus:bg-short/10 focus:text-short [&_svg]:text-short focus:[&_svg]:text-short")}
        >
          <LogOut className="size-4" aria-hidden="true" />
          {signingOut ? "Saindo..." : "Sair"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
