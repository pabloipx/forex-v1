"use client"

import Link from "next/link"
import { AccountSelector } from "./account-selector"

interface TradingHeaderProps {
  balance: { real: number; demo: number }
  isDemo: boolean
  payout: number
  onToggleDemo: (isDemo: boolean) => void
}

export function TradingHeader({ balance, isDemo, payout, onToggleDemo }: TradingHeaderProps) {
  return (
    <header className="bg-[#0a1f44] border-b border-[#2190ff]/30 px-4 py-3">
      <div className="flex items-center justify-between">
        {/* Logo */}
        <Link href="/futures" className="flex items-center gap-2">
          <div className="flex items-end gap-0.5">
            <div className="w-1 h-3 bg-[#4da6ff] rounded-sm" />
            <div className="w-1 h-5 bg-[#2190ff] rounded-sm" />
            <div className="w-1 h-4 bg-[#4da6ff] rounded-sm" />
            <div className="w-1 h-6 bg-[#2190ff] rounded-sm" />
          </div>
          <span className="text-white font-bold text-lg">
            Krypto<span className="text-[#2190FF]">bit</span>
          </span>
        </Link>

        {/* Account Selector */}
        <AccountSelector balance={balance} isDemo={isDemo} payout={payout} onToggleDemo={onToggleDemo} />
      </div>
    </header>
  )
}
