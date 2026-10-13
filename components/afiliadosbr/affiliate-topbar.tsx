"use client"

import Image from "next/image"
import { ChevronDown } from "lucide-react"
import { useMoney } from "./currency-context"
import { AffiliateBrand } from "./affiliate-brand"

interface AffiliateTopbarProps {
  userName: string
  balance: number
  nextPayment: string
}

export function AffiliateTopbar({ userName, balance, nextPayment }: AffiliateTopbarProps) {
  const brl = useMoney()

  return (
    <header className="flex h-[72px] shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6">
      <div className="flex items-center gap-6">
        <AffiliateBrand className="h-9" />

        <button
          type="button"
          className="flex items-center gap-2 rounded-full border border-gray-200 px-3.5 py-2 text-[15px] text-gray-800 transition-colors hover:bg-gray-50"
        >
          <Image
            src="https://flagcdn.com/w40/br.png"
            alt="Brasil"
            width={20}
            height={20}
            className="h-5 w-5 rounded-full object-cover"
            unoptimized
          />
          Português
          <ChevronDown className="h-4 w-4 text-gray-500" />
        </button>
      </div>

      <div className="flex items-center gap-5">
        <div className="hidden items-center gap-3 md:flex">
          <span className="text-[15px] text-gray-600">Próximo pagamento</span>
          <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-[15px] font-medium text-emerald-700">
            {nextPayment}
          </span>
        </div>

        <div className="h-8 w-px bg-gray-200" />

        <span className="text-[17px] font-semibold text-gray-900">{brl(balance)}</span>

        <div className="h-8 w-px bg-gray-200" />

        <p className="max-w-[180px] text-right text-[15px] leading-tight text-gray-900">{userName}</p>
      </div>
    </header>
  )
}
