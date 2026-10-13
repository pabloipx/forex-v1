"use client"

import { useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import {
  Home,
  Users,
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  Settings,
  BarChart3,
  LogOut,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  CreditCard,
  Globe,
  Shield,
  UserPlus,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface AdminSidebarProps {
  activeSection: string
  onSectionChange: (section: string) => void
}

export function AdminSidebar({ activeSection, onSectionChange }: AdminSidebarProps) {
  const router = useRouter()
  const [configOpen, setConfigOpen] = useState(true)
  const [adminOpen, setAdminOpen] = useState(true)
  const [operacoesOpen, setOperacoesOpen] = useState(true)

  const handleLogout = () => {
    sessionStorage.removeItem("admin_authenticated")
    router.push("/admin001")
  }

  const menuItems = [
    { id: "inicio", label: "Inicio", icon: Home },
    { id: "estatisticas", label: "Estatisticas", icon: BarChart3 },
    { id: "afiliados", label: "Afiliados", icon: UserPlus },
  ]

  const configItems = [
    { id: "mercados", label: "Mercados", icon: TrendingUp },
    { id: "pagamentos", label: "Metodos de Pagamento", icon: CreditCard },
    { id: "plataforma", label: "Configuracoes", icon: Settings },
    { id: "landpage", label: "Landpage", icon: Globe },
  ]

  const operacoesItems = [
    { id: "operacoes", label: "Trades", icon: TrendingUp },
  ]

  const adminItems = [
    { id: "usuarios", label: "Usuarios", icon: Users },
    { id: "depositos", label: "Depositos", icon: ArrowDownCircle },
    { id: "saques", label: "Saques", icon: ArrowUpCircle },
    { id: "carteira", label: "Carteira", icon: Wallet },
    { id: "seguranca", label: "Seguranca", icon: Shield },
  ]

  return (
    <aside className="w-64 bg-[#0D1117] border-r border-[#1E2430] flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="p-4 border-b border-[#1E2430]">
        <Image
          src="/images/uryn-fox-logo.png"
          alt="URYNBROKER"
          width={150}
          height={40}
          priority
          className="mx-auto h-auto w-[150px]"
        />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {/* Main Menu */}
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onSectionChange(item.id)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
              activeSection === item.id
                ? "bg-[#f97316]/20 text-[#fb923c]"
                : "text-gray-400 hover:text-white hover:bg-[#1E2430]",
            )}
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </button>
        ))}

        {/* Configurações Section */}
        <div className="pt-4">
          <button
            onClick={() => setConfigOpen(!configOpen)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider"
          >
            Configurações
            {configOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          {configOpen && (
            <div className="space-y-1 mt-1">
              {configItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onSectionChange(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    activeSection === item.id
                      ? "bg-[#f97316]/20 text-[#fb923c]"
                      : "text-gray-400 hover:text-white hover:bg-[#1E2430]",
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Operacoes Section */}
        <div className="pt-4">
          <button
            onClick={() => setOperacoesOpen(!operacoesOpen)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider"
          >
            Operacoes
            {operacoesOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          {operacoesOpen && (
            <div className="space-y-1 mt-1">
              {operacoesItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onSectionChange(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    activeSection === item.id
                      ? "bg-[#f97316]/20 text-[#fb923c]"
                      : "text-gray-400 hover:text-white hover:bg-[#1E2430]",
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Administracao Section */}
        <div className="pt-4">
          <button
            onClick={() => setAdminOpen(!adminOpen)}
            className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-gray-500 uppercase tracking-wider"
          >
            Administracao
            {adminOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          {adminOpen && (
            <div className="space-y-1 mt-1">
              {adminItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => onSectionChange(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    activeSection === item.id
                      ? "bg-[#f97316]/20 text-[#fb923c]"
                      : "text-gray-400 hover:text-white hover:bg-[#1E2430]",
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-[#1E2430]">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Sair
        </button>
      </div>
    </aside>
  )
}
