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
    <header className="bg-[#7c2d12] border-b border-[#f97316]/30 px-4 py-3">
      <div className="flex items-center justify-between">
        {/* Logo */}
        <Link href="/trade" className="flex items-center gap-2">
          <div className="flex items-end gap-0.5">
            <div className="w-1 h-3 bg-[#fb923c] rounded-sm" />
            <div className="w-1 h-5 bg-[#f97316] rounded-sm" />
            <div className="w-1 h-4 bg-[#fb923c] rounded-sm" />
            <div className="w-1 h-6 bg-[#f97316] rounded-sm" />
          </div>
          <span className="text-white font-bold text-lg">
            URYN<span className="text-[#fb923c]"> BROKER</span>
          </span>
        </Link>

        {/* Account Selector */}
        <AccountSelector balance={balance} isDemo={isDemo} payout={payout} onToggleDemo={onToggleDemo} />
      </div>
    </header>
  )
}
