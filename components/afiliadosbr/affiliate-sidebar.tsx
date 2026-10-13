"use client"

import { useState } from "react"
import {
  BarChart3,
  ChevronDown,
  ChevronUp,
  Code2,
  Columns2,
  LogOut,
  Tag,
  UserCircle,
  UserPlus,
  Wallet,
} from "lucide-react"
import type { AffiliateSection } from "./types"

interface AffiliateSidebarProps {
  active: AffiliateSection
  onChange: (section: AffiliateSection) => void
  onSignOut: () => void
}

export function AffiliateSidebar({ active, onChange, onSignOut }: AffiliateSidebarProps) {
  const [statsOpen, setStatsOpen] = useState(true)
  const [postbacksOpen, setPostbacksOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)

  const itemClass = (isActive: boolean) =>
    `flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-[15px] transition-colors ${
      isActive ? "bg-gray-100 font-medium text-gray-900" : "text-gray-700 hover:bg-gray-50"
    }`

  return (
    <aside className="flex w-[272px] shrink-0 flex-col justify-between border-r border-gray-200 bg-white py-4">
      <nav className="flex flex-col gap-1 px-3">
        <button type="button" onClick={() => setStatsOpen((v) => !v)} className={itemClass(false)}>
          <BarChart3 className="h-5 w-5 text-gray-500" />
          <span className="flex-1 text-left">Estatísticas</span>
          {statsOpen ? (
            <ChevronUp className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          )}
        </button>

        {statsOpen && (
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => onChange("stats-general")}
              className={`${itemClass(active === "stats-general")} pl-12`}
            >
              Geral
            </button>
            <button
              type="button"
              onClick={() => onChange("stats-clients")}
              className={`${itemClass(active === "stats-clients")} pl-12`}
            >
              Por clientes
            </button>
          </div>
        )}

        <button type="button" onClick={() => onChange("offers")} className={itemClass(active === "offers")}>
          <Tag className="h-5 w-5 text-gray-500" />
          Ofertas
        </button>

        <button type="button" onClick={() => onChange("payments")} className={itemClass(active === "payments")}>
          <Wallet className="h-5 w-5 text-gray-500" />
          Pagamentos
        </button>

        <button type="button" onClick={() => onChange("competition")} className={itemClass(active === "competition")}>
          <Columns2 className="h-5 w-5 text-gray-500" />
          Competição
        </button>

        <button
          type="button"
          onClick={() => onChange("sub-affiliate")}
          className={itemClass(active === "sub-affiliate")}
        >
          <UserPlus className="h-5 w-5 text-gray-500" />
          Sub-afiliado
        </button>

        <button
          type="button"
          onClick={() => setPostbacksOpen((v) => !v)}
          className={itemClass(active === "postbacks")}
        >
          <Code2 className="h-5 w-5 text-gray-500" />
          <span className="flex-1 text-left">Postbacks</span>
          {postbacksOpen ? (
            <ChevronUp className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          )}
        </button>

        {postbacksOpen && (
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => onChange("postbacks-general")}
              className={`${itemClass(active === "postbacks-general")} pl-12`}
            >
              Geral
            </button>
            <button
              type="button"
              onClick={() => onChange("postbacks-telegram")}
              className={`${itemClass(active === "postbacks-telegram")} pl-12`}
            >
              Bot do Telegram
            </button>
          </div>
        )}

        <button type="button" onClick={() => setAccountOpen((v) => !v)} className={itemClass(active === "account")}>
          <UserCircle className="h-5 w-5 text-gray-500" />
          <span className="flex-1 text-left">Configurações da conta</span>
          {accountOpen ? (
            <ChevronUp className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          )}
        </button>

        {accountOpen && (
          <div className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => onChange("account")}
              className={`${itemClass(active === "account")} pl-12`}
            >
              Geral
            </button>
            <button
              type="button"
              onClick={() => onChange("account-security")}
              className={`${itemClass(active === "account-security")} pl-12`}
            >
              Segurança
            </button>
            <button
              type="button"
              onClick={() => onChange("account-profile")}
              className={`${itemClass(active === "account-profile")} pl-12`}
            >
              Informações do perfil
            </button>
          </div>
        )}
      </nav>

      <div className="px-3">
        <div className="flex items-center gap-3 rounded-lg px-4 py-3">
          <div className="relative">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-900 text-sm font-semibold text-orange-400">
              UB
            </span>
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
          </div>
          <div className="text-sm leading-tight text-gray-700">
            <p className="font-medium text-gray-900">Suporte URYN</p>
            <p className="text-gray-500">8:00 - 21:00</p>
            <p className="text-gray-500">Seg – Sex</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onSignOut}
          className="mt-1 flex w-full items-center justify-between rounded-lg px-4 py-3 text-[15px] text-gray-700 transition-colors hover:bg-gray-50"
        >
          Sair
          <LogOut className="h-5 w-5 text-gray-400" />
        </button>
      </div>
    </aside>
  )
}
