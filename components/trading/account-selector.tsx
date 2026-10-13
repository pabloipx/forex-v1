"use client"

import { useState, useRef, useEffect } from "react"
import { ChevronDown, Wallet, TrendingUp } from "lucide-react"

interface AccountSelectorProps {
  balance: { real: number; demo: number }
  isDemo: boolean
  payout: number
  onToggleDemo: (isDemo: boolean) => void
}

export function AccountSelector({ balance, isDemo, payout, onToggleDemo }: AccountSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const currentBalance = isDemo ? balance.demo : balance.real
  const accountType = isDemo ? "Conta demo" : "Conta real"

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value)
  }

  const selectAccount = (demo: boolean) => {
    onToggleDemo(demo)
    setIsOpen(false)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-[#121826] border border-[#1F2933] rounded-lg px-3 py-2 hover:border-[#f97316]/50 transition-colors"
      >
        {/* Account Type + Payout Badge */}
        <div className="flex items-center gap-2">
          <span className="text-[#9CA3AF] text-sm">{accountType}</span>
          <span className="bg-[#E91E63] text-white text-xs font-bold px-2 py-0.5 rounded">+{payout}%</span>
        </div>

        {/* Balance */}
        <span className="text-white font-bold text-lg ml-1">{formatCurrency(currentBalance)}</span>

        {/* Chevron */}
        <ChevronDown className={`w-4 h-4 text-[#6B7280] transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-72 bg-[#121826] border border-[#1F2933] rounded-xl shadow-xl z-50 overflow-hidden">
          {/* Demo Account Option */}
          <button
            onClick={() => selectAccount(true)}
            className={`w-full flex items-center justify-between px-4 py-3 hover:bg-[#1F2933] transition-colors ${
              isDemo ? "bg-[#f97316]/10 border-l-2 border-[#f97316]" : ""
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  isDemo ? "bg-[#F59E0B]/20" : "bg-[#1F2933]"
                }`}
              >
                <TrendingUp className={`w-5 h-5 ${isDemo ? "text-[#F59E0B]" : "text-[#6B7280]"}`} />
              </div>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium">Conta demo</span>
                  <span className="bg-[#F59E0B]/20 text-[#F59E0B] text-xs px-2 py-0.5 rounded">PRÁTICA</span>
                </div>
                <span className="text-[#9CA3AF] text-sm">Treine sem riscos</span>
              </div>
            </div>
            <span className={`font-bold ${isDemo ? "text-[#F59E0B]" : "text-white"}`}>
              {formatCurrency(balance.demo)}
            </span>
          </button>

          {/* Divider */}
          <div className="border-t border-[#1F2933]" />

          {/* Real Account Option */}
          <button
            onClick={() => selectAccount(false)}
            className={`w-full flex items-center justify-between px-4 py-3 hover:bg-[#1F2933] transition-colors ${
              !isDemo ? "bg-[#f97316]/10 border-l-2 border-[#f97316]" : ""
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  !isDemo ? "bg-[#f97316]/20" : "bg-[#1F2933]"
                }`}
              >
                <Wallet className={`w-5 h-5 ${!isDemo ? "text-[#f97316]" : "text-[#6B7280]"}`} />
              </div>
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <span className="text-white font-medium">Conta real</span>
                  <span className="bg-[#f97316]/20 text-[#f97316] text-xs px-2 py-0.5 rounded">DINHEIRO</span>
                </div>
                <span className="text-[#9CA3AF] text-sm">Opere com saldo real</span>
              </div>
            </div>
            <span className={`font-bold ${!isDemo ? "text-[#f97316]" : "text-white"}`}>
              {formatCurrency(balance.real)}
            </span>
          </button>

          {/* Deposit Button */}
          <div className="border-t border-[#1F2933] p-3">
            <button className="w-full bg-[#f97316] hover:bg-[#fb923c] text-white font-bold py-2.5 rounded-lg transition-colors">
              Depositar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
