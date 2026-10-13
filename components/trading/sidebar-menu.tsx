"use client"

import { memo, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  X,
  History,
  User,
  CreditCard,
  Banknote as Banknotes,
  MessageCircle,
  LogOut,
  ChevronRight,
  Shield,
  Wallet,
} from "lucide-react"

interface SidebarMenuProps {
  isOpen: boolean
  onClose: () => void
  userName?: string
  balance?: number
  onOpenTraderIA?: () => void
  userId?: string
  historyRefresh?: number
}

function SidebarMenuBase({
  isOpen,
  onClose,
  userName,
  balance,
}: SidebarMenuProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false)

  const handleNavigation = (href: string) => {
    onClose()
    window.location.href = href
  }

  const handleLogout = async () => {
    setIsLoggingOut(true)
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      window.location.href = "/auth/login"
    } catch (error) {
      console.error("Logout error:", error)
      setIsLoggingOut(false)
    }
  }

  const mainMenuItems = [
    { icon: History, label: "Historico", href: "/transactions" },
    { icon: User, label: "Perfil", href: "/profile" },
  ]

  const financeMenuItems = [
    { icon: CreditCard, label: "Deposito", href: "/deposit" },
    { icon: Banknotes, label: "Saque", href: "/withdraw" },
  ]

  const supportMenuItems = [
    { icon: MessageCircle, label: "Suporte", href: "/suporte" },
  ]

  const formatBRL = (value: number | undefined | null) => {
    const safeValue = typeof value === "number" && !isNaN(value) ? value : 0
    return safeValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
  }

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 bg-black/70 backdrop-blur-sm z-50 transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Sidebar */}
      <div
        className={`fixed top-0 left-0 h-full w-[300px] md:w-[340px] z-50 transform transition-transform duration-300 ease-out flex flex-col ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ backgroundColor: "#0d1117" }}
      >
        {/* Header with user info */}
        <div className="p-5 pb-0 flex-shrink-0">
          <div className="flex items-center justify-between mb-5">
            <img
              src="/images/uryn-fox-logo.png"
              alt="URYNBROKER"
              className="h-8 w-auto"
            />
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* User Profile Card */}
          <div className="relative rounded-2xl overflow-hidden mb-5 bg-[#12100e] border border-white/[0.08]">
            <div className="absolute -top-16 -right-10 w-40 h-40 rounded-full bg-[#f97316]/20 blur-3xl pointer-events-none" />
            <div className="relative p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#fb923c] to-[#c2410c] flex items-center justify-center shadow-lg shadow-orange-500/25 ring-2 ring-[#f97316]/20">
                  <span className="text-white font-bold text-lg">
                    {userName ? userName.charAt(0).toUpperCase() : "U"}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-white font-semibold text-sm truncate">{userName || "Trader"}</div>
                  <div className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full bg-[#f97316]/10 border border-[#f97316]/20">
                    <Shield className="w-3 h-3 text-[#fb923c]" />
                    <span className="text-[#fb923c] text-[10px] font-semibold tracking-wide">VIP Bronze</span>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-white/[0.06]">
                <div className="text-white/40 text-[10px] uppercase tracking-wider font-medium mb-1">Saldo Disponivel</div>
                <div className="text-white font-bold text-2xl tracking-tight">{formatBRL(balance)}</div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button
              onClick={() => handleNavigation("/deposit")}
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[#f97316] hover:bg-[#c2410c] text-white text-xs font-semibold transition shadow-lg shadow-orange-500/20"
            >
              <Wallet className="w-3.5 h-3.5" />
              Depositar
            </button>
            <button
              onClick={() => handleNavigation("/withdraw")}
              className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-semibold transition border border-white/10"
            >
              <Banknotes className="w-3.5 h-3.5" />
              Sacar
            </button>
          </div>
        </div>

        {/* Divider */}
        <div className="mx-5 border-t border-white/[0.06]" />

        {/* Menu Items */}
        <nav className="flex-1 overflow-y-auto px-3 py-3">
          <div className="mb-1">
            <span className="px-3 text-[10px] uppercase tracking-widest text-white/25 font-semibold">Conta</span>
          </div>
          {mainMenuItems.map((item) => (
            <button
              key={item.label}
              onClick={() => handleNavigation(item.href)}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-white/60 hover:text-white hover:bg-white/[0.04] rounded-xl transition group"
            >
              <div className="w-8 h-8 rounded-lg bg-white/[0.04] group-hover:bg-[#f97316]/10 flex items-center justify-center transition">
                <item.icon className="w-4 h-4 text-white/40 group-hover:text-[#fb923c] transition" />
              </div>
              <span className="flex-1 text-left text-[13px] font-medium">{item.label}</span>
              <ChevronRight className="w-3.5 h-3.5 text-white/15 group-hover:text-white/30 transition" />
            </button>
          ))}

          <div className="mt-4 mb-1">
            <span className="px-3 text-[10px] uppercase tracking-widest text-white/25 font-semibold">Financeiro</span>
          </div>
          {financeMenuItems.map((item) => (
            <button
              key={item.label}
              onClick={() => handleNavigation(item.href)}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-white/60 hover:text-white hover:bg-white/[0.04] rounded-xl transition group"
            >
              <div className="w-8 h-8 rounded-lg bg-white/[0.04] group-hover:bg-[#f97316]/10 flex items-center justify-center transition">
                <item.icon className="w-4 h-4 text-white/40 group-hover:text-[#fb923c] transition" />
              </div>
              <span className="flex-1 text-left text-[13px] font-medium">{item.label}</span>
              <ChevronRight className="w-3.5 h-3.5 text-white/15 group-hover:text-white/30 transition" />
            </button>
          ))}

          <div className="mt-4 mb-1">
            <span className="px-3 text-[10px] uppercase tracking-widest text-white/25 font-semibold">Ajuda</span>
          </div>
          {supportMenuItems.map((item) => (
            <button
              key={item.label}
              onClick={() => handleNavigation(item.href)}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-white/60 hover:text-white hover:bg-white/[0.04] rounded-xl transition group"
            >
              <div className="w-8 h-8 rounded-lg bg-white/[0.04] group-hover:bg-[#f97316]/10 flex items-center justify-center transition">
                <item.icon className="w-4 h-4 text-white/40 group-hover:text-[#fb923c] transition" />
              </div>
              <span className="flex-1 text-left text-[13px] font-medium">{item.label}</span>
              <ChevronRight className="w-3.5 h-3.5 text-white/15 group-hover:text-white/30 transition" />
            </button>
          ))}
        </nav>

        {/* Bottom section */}
        <div className="flex-shrink-0 p-3 border-t border-white/[0.06]">
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 text-red-400/80 hover:text-red-400 hover:bg-red-500/[0.06] rounded-xl transition group"
          >
            <div className="w-8 h-8 rounded-lg bg-red-500/[0.06] group-hover:bg-red-500/10 flex items-center justify-center transition">
              <LogOut className="w-4 h-4" />
            </div>
            <span className="flex-1 text-left text-[13px] font-medium">
              {isLoggingOut ? "Saindo..." : "Sair da Conta"}
            </span>
          </button>
        </div>
      </div>
    </>
  )
}

// Memoizado para não re-renderizar o menu lateral a cada tick de preço da tela de trade.
// Os callbacks (onClose, onOpenTraderIA) são estabilizados com useCallback no componente pai.
export const SidebarMenu = memo(SidebarMenuBase)
