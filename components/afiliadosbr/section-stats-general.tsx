"use client"

import { useMemo, useState } from "react"
import { Calendar, ChevronDown, Table2, X } from "lucide-react"
import { shortDate, type AffiliateReferral } from "./types"
import { useMoney } from "./currency-context"

interface SectionStatsGeneralProps {
  referrals: AffiliateReferral[]
}

type GroupBy = "day" | "month" | "total"

const groupLabels: Record<GroupBy, string> = {
  day: "Dia",
  month: "Mês",
  total: "Total",
}

/** Valor sentinela para indicacoes que chegaram sem subID na URL. */
const NO_SUBID = "__none__"

export function SectionStatsGeneral({ referrals }: SectionStatsGeneralProps) {
  const brl = useMoney()
  const [groupBy, setGroupBy] = useState<GroupBy>("day")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [subId, setSubId] = useState("all")
  const [applied, setApplied] = useState({ groupBy: "day" as GroupBy, from: "", to: "", subId: "all" })

  // Opcoes vindas das proprias indicacoes: so aparece o que o afiliado realmente usou.
  const subIdOptions = useMemo(() => {
    const named = new Set<string>()
    let hasEmpty = false
    for (const referral of referrals) {
      const value = referral.subid?.trim()
      if (value) named.add(value)
      else hasEmpty = true
    }
    const sorted = Array.from(named).sort((a, b) => a.localeCompare(b, "pt-BR"))
    // "Sem subID" so faz sentido como opcao se houver ao menos um subID nomeado para contrastar.
    return hasEmpty && sorted.length > 0 ? [...sorted, NO_SUBID] : sorted
  }, [referrals])

  const rows = useMemo(() => {
    const start = applied.from ? new Date(`${applied.from}T00:00:00`) : null
    const end = applied.to ? new Date(`${applied.to}T23:59:59`) : null

    const filtered = referrals.filter((r) => {
      const created = new Date(r.created_at)
      if (start && created < start) return false
      if (end && created > end) return false
      if (applied.subId !== "all") {
        const value = r.subid?.trim() || ""
        if (applied.subId === NO_SUBID ? value !== "" : value !== applied.subId) return false
      }
      return true
    })

    const buckets = new Map<
      string,
      { label: string; registrations: number; withDeposit: number; deposits: number; commission: number }
    >()

    for (const referral of filtered) {
      const created = new Date(referral.created_at)
      let key = "total"
      let label = "Total do período"

      if (applied.groupBy === "day") {
        key = created.toISOString().slice(0, 10)
        label = shortDate(referral.created_at)
      } else if (applied.groupBy === "month") {
        key = created.toISOString().slice(0, 7)
        label = created.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
      }

      const bucket = buckets.get(key) ?? { label, registrations: 0, withDeposit: 0, deposits: 0, commission: 0 }
      bucket.registrations += 1
      if (referral.total_deposits > 0) bucket.withDeposit += 1
      bucket.deposits += Number(referral.total_deposits) || 0
      bucket.commission += Number(referral.total_commission) || 0
      buckets.set(key, bucket)
    }

    return Array.from(buckets.entries())
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([key, value]) => ({ key, ...value }))
  }, [referrals, applied])

  const totals = useMemo(
    () =>
      rows.reduce(
        (acc, row) => ({
          registrations: acc.registrations + row.registrations,
          withDeposit: acc.withDeposit + row.withDeposit,
          deposits: acc.deposits + row.deposits,
          commission: acc.commission + row.commission,
        }),
        { registrations: 0, withDeposit: 0, deposits: 0, commission: 0 },
      ),
    [rows],
  )

  const hasFilters = Boolean(from || to || groupBy !== "day" || subId !== "all")

  const clearAll = () => {
    setGroupBy("day")
    setFrom("")
    setTo("")
    setSubId("all")
    setApplied({ groupBy: "day", from: "", to: "", subId: "all" })
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight text-gray-900">Estatísticas gerais</h1>
        <p className="mt-1 text-[15px] text-gray-600">
          Monitore suas campanhas com os dados mais precisos em tempo real
        </p>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="flex flex-col gap-2">
            <label htmlFor="group-by" className="text-[15px] text-gray-700">
              Agrupar por
            </label>
            <div className="relative">
              <select
                id="group-by"
                value={groupBy}
                onChange={(e) => setGroupBy(e.target.value as GroupBy)}
                className="h-12 w-full appearance-none rounded-lg border border-gray-300 bg-white px-4 pr-10 text-[15px] text-gray-900 outline-none focus:border-emerald-500"
              >
                {Object.entries(groupLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-[15px] text-gray-700">Período</span>
            <div className="flex h-12 items-center gap-2 rounded-lg border border-gray-300 bg-white px-4">
              <Calendar className="h-4 w-4 shrink-0 text-gray-500" />
              <input
                type="date"
                aria-label="Data inicial"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full bg-transparent text-[15px] text-gray-900 outline-none"
              />
              <span className="text-gray-400">—</span>
              <input
                type="date"
                aria-label="Data final"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full bg-transparent text-[15px] text-gray-900 outline-none"
              />
              {(from || to) && (
                <button
                  type="button"
                  aria-label="Limpar período"
                  onClick={() => {
                    setFrom("")
                    setTo("")
                  }}
                  className="text-gray-400 hover:text-gray-700"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="subid" className="text-[15px] text-gray-700">
              Código de afiliado
            </label>
            <div className="relative">
              <select
                id="subid"
                value={subId}
                onChange={(e) => setSubId(e.target.value)}
                disabled={subIdOptions.length === 0}
                className="h-12 w-full appearance-none rounded-lg border border-gray-300 bg-white px-4 pr-10 text-[15px] text-gray-900 outline-none focus:border-emerald-500 disabled:bg-gray-50 disabled:text-gray-500"
              >
                <option value="all">Todos os subIDs</option>
                {subIdOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === NO_SUBID ? "Sem subID" : option}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <span className="text-[15px] text-gray-500">
            {rows.length > 0 ? `${rows.length} período(s) com atividade` : "Nenhum período com atividade"}
          </span>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={clearAll}
              disabled={!hasFilters}
              className="flex items-center gap-2 text-[15px] text-gray-500 transition-colors hover:text-gray-800 disabled:opacity-40"
            >
              Limpar tudo
              <X className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setApplied({ groupBy, from, to, subId })}
              className="h-11 rounded-lg bg-emerald-400 px-5 text-[15px] font-medium text-gray-900 transition-colors hover:bg-emerald-500"
            >
              Aplicar filtros
            </button>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 p-6">
          <div className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-[15px] text-gray-800">
            <Table2 className="h-4 w-4 text-gray-500" />
            {groupLabels[applied.groupBy]}
          </div>
          <div className="flex items-center gap-3 text-[15px] text-gray-600">
            <span>Comissão do período</span>
            <span className="font-semibold text-gray-900">{brl(totals.commission)}</span>
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-24 text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gray-50">
              <Table2 className="h-8 w-8 text-gray-300" />
            </div>
            <h2 className="text-[22px] font-semibold text-gray-900">Sem dados</h2>
            <p className="max-w-[360px] text-[15px] text-gray-600">
              Não há dados que atendam à sua solicitação. Ajuste o período nos filtros ou compartilhe seu link para
              começar a receber indicações.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-sm text-gray-600">
                <tr>
                  <th className="px-6 py-3 font-medium">Período</th>
                  <th className="px-6 py-3 font-medium">Registros</th>
                  <th className="px-6 py-3 font-medium">Com depósito</th>
                  <th className="px-6 py-3 font-medium">Depósitos</th>
                  <th className="px-6 py-3 font-medium">Comissão</th>
                </tr>
              </thead>
              <tbody className="text-[15px] text-gray-800">
                {rows.map((row) => (
                  <tr key={row.key} className="border-t border-gray-100">
                    <td className="px-6 py-4 capitalize">{row.label}</td>
                    <td className="px-6 py-4">{row.registrations}</td>
                    <td className="px-6 py-4">{row.withDeposit}</td>
                    <td className="px-6 py-4">{brl(row.deposits)}</td>
                    <td className="px-6 py-4 font-medium text-emerald-700">{brl(row.commission)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-gray-200 bg-gray-50 text-[15px] font-medium text-gray-900">
                <tr>
                  <td className="px-6 py-4">Total</td>
                  <td className="px-6 py-4">{totals.registrations}</td>
                  <td className="px-6 py-4">{totals.withDeposit}</td>
                  <td className="px-6 py-4">{brl(totals.deposits)}</td>
                  <td className="px-6 py-4 text-emerald-700">{brl(totals.commission)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
