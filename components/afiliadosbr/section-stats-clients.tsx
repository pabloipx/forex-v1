"use client"

import { useMemo, useState } from "react"
import { Search, Users } from "lucide-react"
import { shortDate, type AffiliateReferral } from "./types"
import { useMoney } from "./currency-context"

interface SectionStatsClientsProps {
  referrals: AffiliateReferral[]
}

export function SectionStatsClients({ referrals }: SectionStatsClientsProps) {
  const brl = useMoney()
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<"all" | "active" | "registered">("all")

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return referrals.filter((referral) => {
      const name = referral.profiles?.full_name?.toLowerCase() || ""
      const email = referral.profiles?.email?.toLowerCase() || ""
      const matchesSearch = !term || name.includes(term) || email.includes(term)
      const matchesFilter =
        filter === "all" ||
        (filter === "active" && referral.total_deposits > 0) ||
        (filter === "registered" && referral.total_deposits === 0)
      return matchesSearch && matchesFilter
    })
  }, [referrals, search, filter])

  const tabs = [
    { key: "all" as const, label: `Todos (${referrals.length})` },
    { key: "active" as const, label: `Com depósito (${referrals.filter((r) => r.total_deposits > 0).length})` },
    { key: "registered" as const, label: `Sem depósito (${referrals.filter((r) => r.total_deposits === 0).length})` },
  ]

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-gray-900">Estatísticas por clientes</h1>
        <p className="mt-1 text-[15px] text-gray-600">Acompanhe cada indicação e a comissão gerada por ela</p>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-200 p-6">
          <div className="flex flex-wrap items-center gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilter(tab.key)}
                className={`rounded-lg px-4 py-2 text-[15px] transition-colors ${
                  filter === tab.key ? "bg-gray-100 font-medium text-gray-900" : "text-gray-600 hover:bg-gray-50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="relative w-full max-w-[280px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              placeholder="Buscar por nome ou e-mail"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-4 text-[15px] text-gray-900 outline-none placeholder:text-gray-400 focus:border-emerald-500"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-24 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gray-50">
              <Users className="h-8 w-8 text-gray-300" />
            </div>
            <h2 className="text-[22px] font-semibold text-gray-900">Sem clientes</h2>
            <p className="max-w-[360px] text-[15px] text-gray-600">
              Nenhuma indicação encontrada com os filtros atuais. Compartilhe seu link de afiliado para começar.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-sm text-gray-600">
                <tr>
                  <th className="px-6 py-3 font-medium">Cliente</th>
                  <th className="px-6 py-3 font-medium">Registro</th>
                  <th className="px-6 py-3 font-medium">Status</th>
                  <th className="px-6 py-3 font-medium">Depósitos</th>
                  <th className="px-6 py-3 font-medium">Comissão</th>
                </tr>
              </thead>
              <tbody className="text-[15px] text-gray-800">
                {filtered.map((referral) => (
                  <tr key={referral.id} className="border-t border-gray-100">
                    <td className="px-6 py-4">
                      <p className="font-medium text-gray-900">{referral.profiles?.full_name || "Sem nome"}</p>
                      <p className="text-sm text-gray-500">{referral.profiles?.email || "—"}</p>
                    </td>
                    <td className="px-6 py-4">{shortDate(referral.created_at)}</td>
                    <td className="px-6 py-4">
                      {referral.total_deposits > 0 ? (
                        <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-sm font-medium text-emerald-700">
                          Ativo
                        </span>
                      ) : (
                        <span className="rounded-md bg-gray-100 px-2.5 py-1 text-sm font-medium text-gray-600">
                          Registrado
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">{brl(referral.total_deposits)}</td>
                    <td className="px-6 py-4 font-medium text-emerald-700">{brl(referral.total_commission)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
