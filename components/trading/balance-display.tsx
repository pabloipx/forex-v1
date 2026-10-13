"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { ChevronDown, Diamond } from "lucide-react"

export function BalanceDisplay({ balance }: { balance: number }) {
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const checkAdmin = async () => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        const { data: adminData } = await supabase.from("admin_users").select("*").eq("user_id", user.id).single()
        setIsAdmin(!!adminData)
      }
    }

    checkAdmin()
  }, [])

  return (
    <div className="flex items-center gap-3">
      {/* Diamond VIP icon */}
      <Diamond className="w-5 h-5 text-orange-500" strokeWidth={1.5} />

      {/* Account balance dropdown */}
      <button className="flex items-center gap-2 bg-[#1a1a1f] hover:bg-[#22222a] rounded px-3 py-1.5 transition-colors">
        <div className="flex flex-col items-start">
          <div className="flex items-center gap-2">
            <span className="text-white/60 text-[11px]">Conta demo</span>
            <span className="bg-pink-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">+85%</span>
          </div>
          <span className="text-white font-semibold text-sm">
            R$ {balance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
          </span>
        </div>
        <ChevronDown className="w-4 h-4 text-white/50" />
      </button>

      {/* Deposit button */}
      <Button className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold h-9 px-4 rounded">
        Depósito
      </Button>

      {/* Admin link if admin */}
      {isAdmin && (
        <Button asChild size="sm" variant="ghost" className="text-white/60 hover:text-white hover:bg-white/10 h-8 px-2">
          <Link href="/admin001">Admin</Link>
        </Button>
      )}
    </div>
  )
}
