"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Users,
  DollarSign,
  TrendingUp,
  UserPlus,
  Search,
  RefreshCw,
  Check,
  X,
  Clock,
  Loader2,
  Wallet,
  Target,
  Percent,
  ArrowUpRight,
  Settings2,
  History,
} from "lucide-react"
import { AffiliateDrawer, StatusPill } from "@/components/admin/affiliates/affiliate-drawer"
import {
  ADMIN_TOKEN,
  MODEL_LABEL,
  compact,
  dateTime,
  money,
  patchAffiliate,
  pct,
  type AdminAffiliate,
  type AdminCommission,
  type AdminLog,
  type AdminSettings,
  type AdminStats,
  type AdminWithdrawal,
} from "@/components/admin/affiliates/types"

type Tab = "overview" | "affiliates" | "withdrawals" | "commissions" | "settings"

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "overview", label: "Visão geral" },
  { id: "affiliates", label: "Afiliados" },
  { id: "withdrawals", label: "Saques" },
  { id: "commissions", label: "Comissões" },
  { id: "settings", label: "Configurações" },
]

const EMPTY_STATS: AdminStats = {
  totalAffiliates: 0,
  activeAffiliates: 0,
  blockedAffiliates: 0,
  totalReferrals: 0,
  totalDepositors: 0,
  totalDeposited: 0,
  totalEarned: 0,
  totalRevshare: 0,
  totalCpa: 0,
  totalBalance: 0,
  totalPaidOut: 0,
  pendingPayout: 0,
  pendingCount: 0,
  netRevenue: 0,
}

const EMPTY_SETTINGS: AdminSettings = {
  default_revshare_percent: 77,
  default_cpa_amount: 100,
  cpa_min_deposit: 50,
  sub_affiliate_percent: 5,
  min_withdrawal: 250,
  withdrawal_fee_percent: 2,
  program_enabled: true,
  auto_approve_affiliates: true,
  display_currency: "BRL",
  usd_rate: 5.4,
  next_payment_date: null,
  updated_at: null,
}

const cardClass = "rounded-xl bg-[#121826] border border-[#1F2933]"
const inputClass =
  "h-10 rounded-lg bg-[#0a0e17] border border-[#1F2933] px-3 text-sm text-white outline-none focus:border-[#f97316]"
const thClass = "px-3 py-3 text-left text-[11px] font-medium uppercase tracking-wide text-white/40"

type SortKey = "recent" | "earned" | "referrals" | "deposits" | "balance"

export function AdminAffiliates() {
  const [tab, setTab] = useState<Tab>("overview")
  const [affiliates, setAffiliates] = useState<AdminAffiliate[]>([])
  const [pending, setPending] = useState<AdminWithdrawal[]>([])
  const [processed, setProcessed] = useState<AdminWithdrawal[]>([])
  const [commissions, setCommissions] = useState<AdminCommission[]>([])
  const [logs, setLogs] = useState<AdminLog[]>([])
  const [stats, setStats] = useState<AdminStats>(EMPTY_STATS)
  const [settings, setSettings] = useState<AdminSettings>(EMPTY_SETTINGS)

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [modelFilter, setModelFilter] = useState("all")
  const [sortKey, setSortKey] = useState<SortKey>("earned")
  const [selected, setSelected] = useState<AdminAffiliate | null>(null)
  const [processing, setProcessing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadData = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/affiliates", { headers: { "x-admin-token": ADMIN_TOKEN } })
      if (!res.ok) throw new Error("Falha ao carregar dados dos afiliados")
      const data = await res.json()
      setAffiliates(data.affiliates ?? [])
      setPending(data.pendingWithdrawals ?? [])
      setProcessed(data.processedWithdrawals ?? [])
      setCommissions(data.commissions ?? [])
      setLogs(data.logs ?? [])
      setStats({ ...EMPTY_STATS, ...(data.stats ?? {}) })
      setSettings({ ...EMPTY_SETTINGS, ...(data.settings ?? {}) })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar dados")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const processWithdrawal = async (id: string, status: "completed" | "rejected") => {
    setProcessing(id)
    setError(null)
    try {
      await patchAffiliate({ action: "process_withdrawal", data: { withdrawalId: id, status } })
      await loadData(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao processar saque")
    } finally {
      setProcessing(null)
    }
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    const list = affiliates.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false
      if (modelFilter !== "all" && a.terms.model !== modelFilter) return false
      if (!term) return true
      return (
        a.name.toLowerCase().includes(term) ||
        a.email.toLowerCase().includes(term) ||
        a.code.toLowerCase().includes(term)
      )
    })

    const sorters: Record<SortKey, (a: AdminAffiliate, b: AdminAffiliate) => number> = {
      recent: (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      earned: (a, b) => b.total_earned - a.total_earned,
      referrals: (a, b) => b.referrals - a.referrals,
      deposits: (a, b) => b.deposit_total - a.deposit_total,
      balance: (a, b) => b.balance - a.balance,
    }
    return [...list].sort(sorters[sortKey])
  }, [affiliates, search, statusFilter, modelFilter, sortKey])

  const topAffiliates = useMemo(() => [...affiliates].sort((a, b) => b.total_earned - a.total_earned).slice(0, 5), [affiliates])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#f97316]" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">Programa de afiliados</h1>
          <p className="text-sm text-white/40">
            Monitore o desempenho e defina os valores de CPA e RevShare de cada afiliado
          </p>
        </div>
        <button
          type="button"
          onClick={() => loadData(true)}
          className="flex h-10 items-center gap-2 rounded-lg border border-[#1F2933] px-4 text-sm text-white/70 hover:bg-[#121826] hover:text-white"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Atualizar
        </button>
      </header>

      {error && <p className="rounded-lg bg-red-500/10 px-3 py-2.5 text-sm text-red-400">{error}</p>}

      <nav className="flex gap-1 overflow-x-auto border-b border-[#1F2933]">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm transition-colors ${
              tab === t.id ? "border-[#f97316] text-white" : "border-transparent text-white/40 hover:text-white/70"
            }`}
          >
            {t.label}
            {t.id === "withdrawals" && pending.length > 0 && (
              <span className="rounded-full bg-yellow-500/20 px-1.5 text-[11px] font-medium text-yellow-400">
                {pending.length}
              </span>
            )}
          </button>
        ))}
      </nav>

      {tab === "overview" && (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard icon={Users} label="Afiliados" value={compact(stats.totalAffiliates)} hint={`${stats.activeAffiliates} ativos · ${stats.blockedAffiliates} bloqueados`} />
            <StatCard icon={UserPlus} label="Referidos" value={compact(stats.totalReferrals)} hint={`${compact(stats.totalDepositors)} depositaram`} />
            <StatCard icon={DollarSign} label="Depositado pelos referidos" value={money(stats.totalDeposited)} hint={`Receita da casa ${money(stats.netRevenue)}`} />
            <StatCard icon={TrendingUp} label="Comissão gerada" value={money(stats.totalEarned)} hint={`Rev ${money(stats.totalRevshare)} · CPA ${money(stats.totalCpa)}`} />
          </div>

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard icon={Wallet} label="Saldo a pagar" value={money(stats.totalBalance)} />
            <StatCard icon={Check} label="Já pago" value={money(stats.totalPaidOut)} />
            <StatCard icon={Clock} label="Saques pendentes" value={money(stats.pendingPayout)} hint={`${stats.pendingCount} solicitações`} />
            <StatCard
              icon={Percent}
              label="Custo sobre receita"
              value={stats.netRevenue > 0 ? pct((stats.totalEarned / stats.netRevenue) * 100) : "—"}
              hint="Comissão ÷ receita da casa"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className={cardClass}>
              <div className="flex items-center justify-between border-b border-[#1F2933] px-4 py-3">
                <p className="text-sm font-semibold text-white">Top afiliados por comissão</p>
                <button
                  type="button"
                  onClick={() => setTab("affiliates")}
                  className="flex items-center gap-1 text-[11px] text-[#f97316] hover:underline"
                >
                  Ver todos <ArrowUpRight className="h-3 w-3" />
                </button>
              </div>
              {topAffiliates.length === 0 ? (
                <p className="p-4 text-sm text-white/40">Nenhum afiliado cadastrado</p>
              ) : (
                <ul className="divide-y divide-[#1F2933]">
                  {topAffiliates.map((a, i) => (
                    <li key={a.id}>
                      <button
                        type="button"
                        onClick={() => setSelected(a)}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[#0a0e17]"
                      >
                        <span className="w-5 text-sm text-white/30">{i + 1}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-white">{a.name}</span>
                          <span className="block truncate text-[11px] text-white/40">
                            {a.code} · {compact(a.referrals)} referidos · {MODEL_LABEL[a.terms.model]}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-semibold text-[#22c55e]">{money(a.total_earned)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className={cardClass}>
              <div className="flex items-center gap-2 border-b border-[#1F2933] px-4 py-3">
                <History className="h-4 w-4 text-white/40" />
                <p className="text-sm font-semibold text-white">Últimas alterações do admin</p>
              </div>
              {logs.length === 0 ? (
                <p className="p-4 text-sm text-white/40">Nenhuma alteração registrada</p>
              ) : (
                <ul className="max-h-[320px] divide-y divide-[#1F2933] overflow-y-auto">
                  {logs.slice(0, 12).map((l) => (
                    <li key={l.id} className="px-4 py-3">
                      <p className="text-sm text-white">
                        {l.action.replace(/_/g, " ")}
                        {l.affiliate_name && <span className="text-white/50"> · {l.affiliate_name}</span>}
                      </p>
                      <p className="text-[11px] text-white/40">
                        {l.old_value ? `${l.old_value} → ` : ""}
                        {l.new_value || "—"}
                      </p>
                      <p className="text-[11px] text-white/25">{dateTime(l.created_at)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      )}

      {tab === "affiliates" && (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative min-w-[220px] flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <input
                className={`${inputClass} w-full pl-9`}
                placeholder="Buscar por nome, email ou código"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <select className={inputClass} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filtrar por status">
              <option value="all">Todos os status</option>
              <option value="active">Ativos</option>
              <option value="pending">Pendentes</option>
              <option value="blocked">Bloqueados</option>
            </select>
            <select className={inputClass} value={modelFilter} onChange={(e) => setModelFilter(e.target.value)} aria-label="Filtrar por modelo">
              <option value="all">Todos os modelos</option>
              <option value="revshare">RevShare</option>
              <option value="cpa">CPA</option>
              <option value="hybrid">Híbrido</option>
            </select>
            <select className={inputClass} value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} aria-label="Ordenar">
              <option value="earned">Maior comissão</option>
              <option value="referrals">Mais referidos</option>
              <option value="deposits">Maior depósito</option>
              <option value="balance">Maior saldo</option>
              <option value="recent">Mais recentes</option>
            </select>
          </div>

          <div className={`${cardClass} overflow-x-auto`}>
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b border-[#1F2933]">
                  <th className={thClass}>Afiliado</th>
                  <th className={thClass}>Modelo</th>
                  <th className={thClass}>RevShare</th>
                  <th className={thClass}>CPA</th>
                  <th className={thClass}>Referidos</th>
                  <th className={thClass}>Depósitos</th>
                  <th className={thClass}>Conversão</th>
                  <th className={thClass}>Comissão</th>
                  <th className={thClass}>Saldo</th>
                  <th className={thClass}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-3 py-8 text-center text-white/40">
                      Nenhum afiliado encontrado
                    </td>
                  </tr>
                ) : (
                  filtered.map((a) => (
                    <tr
                      key={a.id}
                      onClick={() => setSelected(a)}
                      className="cursor-pointer border-b border-[#1F2933] last:border-0 hover:bg-[#0a0e17]"
                    >
                      <td className="px-3 py-3">
                        <p className="text-white">{a.name}</p>
                        <p className="text-[11px] text-white/40">
                          {a.email} · <span className="text-[#f97316]">{a.code}</span>
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <span className="rounded-md bg-[#f97316]/15 px-2 py-0.5 text-[11px] font-medium text-[#f97316]">
                          {MODEL_LABEL[a.terms.model]}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-white/70">{a.terms.revshare_percent}%</td>
                      <td className="px-3 py-3 text-white/70">{money(a.terms.cpa_amount)}</td>
                      <td className="px-3 py-3 text-white/70">
                        {compact(a.referrals)}
                        <span className="text-[11px] text-white/30"> / {compact(a.depositors)} dep.</span>
                      </td>
                      <td className="px-3 py-3 text-white/70">{money(a.deposit_total)}</td>
                      <td className="px-3 py-3 text-white/70">{pct(a.conversion_rate)}</td>
                      <td className="px-3 py-3">
                        <p className="text-[#22c55e]">{money(a.total_earned)}</p>
                        <p className="text-[11px] text-white/30">
                          Rev {money(a.revshare_earned)} · CPA {money(a.cpa_earned)}
                        </p>
                      </td>
                      <td className="px-3 py-3 text-white/70">{money(a.balance)}</td>
                      <td className="px-3 py-3">
                        <span
                          className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
                            a.status === "active"
                              ? "bg-[#22c55e]/15 text-[#22c55e]"
                              : a.status === "blocked"
                                ? "bg-red-500/15 text-red-400"
                                : "bg-yellow-500/15 text-yellow-400"
                          }`}
                        >
                          {a.status === "active" ? "Ativo" : a.status === "blocked" ? "Bloqueado" : "Pendente"}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-white/30">
            Clique em um afiliado para ver o detalhamento completo e ajustar CPA, RevShare, status e saldo.
          </p>
        </div>
      )}

      {tab === "withdrawals" && (
        <div className="flex flex-col gap-5">
          <section className={`${cardClass} ${pending.length > 0 ? "border-yellow-500/30" : ""}`}>
            <div className="flex items-center gap-2 border-b border-[#1F2933] px-4 py-3">
              <Clock className="h-4 w-4 text-yellow-500" />
              <p className="text-sm font-semibold text-white">Pendentes ({pending.length})</p>
              {pending.length > 0 && (
                <span className="ml-auto text-sm text-white/50">{money(stats.pendingPayout)} a liberar</span>
              )}
            </div>
            {pending.length === 0 ? (
              <p className="p-4 text-sm text-white/40">Nenhum saque aguardando aprovação</p>
            ) : (
              <ul className="divide-y divide-[#1F2933]">
                {pending.map((w) => (
                  <li key={w.id} className="flex flex-wrap items-center justify-between gap-4 px-4 py-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-white">{w.profile?.full_name || "Afiliado"}</p>
                      <p className="truncate text-[11px] text-white/40">
                        {w.profile?.affiliate_code || "—"} · {w.pix_key_type}: {w.pix_key}
                      </p>
                      <p className="mt-1 text-base font-semibold text-[#22c55e]">
                        {money(w.net_amount)} <span className="text-[11px] font-normal text-white/40">a pagar</span>
                      </p>
                      <p className="text-[11px] text-white/30">
                        Solicitado {money(w.amount)} · taxa {money(w.fee)} · {dateTime(w.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {processing === w.id ? (
                        <Loader2 className="h-5 w-5 animate-spin text-white/60" />
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => processWithdrawal(w.id, "completed")}
                            className="flex h-10 items-center gap-2 rounded-lg bg-[#22c55e] px-4 text-sm font-medium text-white"
                          >
                            <Check className="h-4 w-4" /> Aprovar
                          </button>
                          <button
                            type="button"
                            onClick={() => processWithdrawal(w.id, "rejected")}
                            className="flex h-10 items-center gap-2 rounded-lg bg-red-500 px-4 text-sm font-medium text-white"
                          >
                            <X className="h-4 w-4" /> Recusar
                          </button>
                        </>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className={`${cardClass} overflow-x-auto`}>
            <div className="border-b border-[#1F2933] px-4 py-3">
              <p className="text-sm font-semibold text-white">Histórico ({processed.length})</p>
            </div>
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-[#1F2933]">
                  <th className={thClass}>Afiliado</th>
                  <th className={thClass}>Solicitado</th>
                  <th className={thClass}>Líquido</th>
                  <th className={thClass}>Chave</th>
                  <th className={thClass}>Processado</th>
                  <th className={thClass}>Status</th>
                </tr>
              </thead>
              <tbody>
                {processed.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-white/40">
                      Nenhum saque processado
                    </td>
                  </tr>
                ) : (
                  processed.map((w) => (
                    <tr key={w.id} className="border-b border-[#1F2933] last:border-0">
                      <td className="px-3 py-3">
                        <p className="text-white">{w.profile?.full_name || "Afiliado"}</p>
                        <p className="text-[11px] text-white/40">{w.profile?.affiliate_code || "—"}</p>
                      </td>
                      <td className="px-3 py-3 text-white/70">{money(w.amount)}</td>
                      <td className="px-3 py-3 text-white/70">{money(w.net_amount)}</td>
                      <td className="px-3 py-3 text-[11px] text-white/50">{w.pix_key}</td>
                      <td className="px-3 py-3 text-white/50">{dateTime(w.processed_at)}</td>
                      <td className="px-3 py-3">
                        <StatusPill status={w.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </section>
        </div>
      )}

      {tab === "commissions" && (
        <section className={`${cardClass} overflow-x-auto`}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1F2933] px-4 py-3">
            <p className="text-sm font-semibold text-white">Comissões recentes</p>
            <p className="text-[11px] text-white/40">
              RevShare {money(stats.totalRevshare)} · CPA {money(stats.totalCpa)}
            </p>
          </div>
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-[#1F2933]">
                <th className={thClass}>Data</th>
                <th className={thClass}>Afiliado</th>
                <th className={thClass}>Referido</th>
                {/* As duas origens tem bases diferentes: o CPA vem do valor depositado e o
                    RevShare vem da receita liquida das operacoes. Rotular so como "Deposito"
                    fazia a receita das operacoes parecer um deposito que nunca existiu. */}
                <th className={thClass}>Base de cálculo</th>
                <th className={thClass}>Origem</th>
                <th className={thClass}>Comissão</th>
              </tr>
            </thead>
            <tbody>
              {commissions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-white/40">
                    Nenhuma comissão registrada
                  </td>
                </tr>
              ) : (
                commissions.map((c) => (
                  <tr key={c.id} className="border-b border-[#1F2933] last:border-0">
                    <td className="px-3 py-3 text-white/50">{dateTime(c.created_at)}</td>
                    <td className="px-3 py-3">
                      <p className="text-white">{c.affiliate_name}</p>
                      <p className="text-[11px] text-[#f97316]">{c.affiliate_code}</p>
                    </td>
                    <td className="px-3 py-3 text-white/70">{c.referred_name}</td>
                    <td className="px-3 py-3 text-white/70">
                      <p>{money(c.deposit_amount)}</p>
                      <p className="text-[11px] text-white/40">
                        {c.cpa_amount > 0 ? "depósito" : "receita das operações"}
                      </p>
                    </td>
                    <td className="px-3 py-3 text-[11px] text-white/50">
                      {c.cpa_amount > 0 ? `CPA ${money(c.cpa_amount)}` : `RevShare ${c.commission_percent}%`}
                    </td>
                    <td className="px-3 py-3 font-medium text-[#22c55e]">{money(c.commission_amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      )}

      {tab === "settings" && <SettingsPanel settings={settings} onSaved={() => loadData(true)} />}

      {selected && (
        <AffiliateDrawer
          affiliate={selected}
          onClose={() => setSelected(null)}
          onSaved={() => loadData(true)}
        />
      )}
    </div>
  )
}

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Users
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className={`${cardClass} p-4`}>
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#f97316]/20">
          <Icon className="h-5 w-5 text-[#f97316]" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] text-white/40">{label}</p>
          <p className="truncate text-lg font-bold text-white">{value}</p>
        </div>
      </div>
      {hint && <p className="mt-2 text-[11px] text-white/30">{hint}</p>}
    </div>
  )
}

function SettingsPanel({ settings, onSaved }: { settings: AdminSettings; onSaved: () => void }) {
  const [form, setForm] = useState(settings)
  const [saving, setSaving] = useState(false)
  const [applying, setApplying] = useState(false)
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null)

  useEffect(() => setForm(settings), [settings])

  const set = <K extends keyof AdminSettings>(key: K, value: AdminSettings[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const save = async () => {
    setSaving(true)
    setMessage(null)
    try {
      await patchAffiliate({ action: "update_settings", data: form })
      setMessage({ type: "ok", text: "Configurações salvas" })
      onSaved()
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Falha ao salvar" })
    } finally {
      setSaving(false)
    }
  }

  const applyToAll = async () => {
    setApplying(true)
    setMessage(null)
    try {
      await patchAffiliate({ action: "apply_defaults_to_all", data: {} })
      setMessage({ type: "ok", text: "Valores padrão aplicados a todos os afiliados" })
      onSaved()
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Falha ao aplicar" })
    } finally {
      setApplying(false)
    }
  }

  return (
    <div className="flex max-w-[720px] flex-col gap-5">
      {message && (
        <p
          role="status"
          aria-live="polite"
          className={`rounded-lg px-3 py-2.5 text-sm ${
            message.type === "ok" ? "bg-[#22c55e]/10 text-[#22c55e]" : "bg-red-500/10 text-red-400"
          }`}
        >
          {message.text}
        </p>
      )}

      <section className={`${cardClass} p-5`}>
        <div className="mb-4 flex items-center gap-2">
          <Target className="h-4 w-4 text-[#f97316]" />
          <p className="text-sm font-semibold text-white">Valores padrão de comissão</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField label="RevShare padrão (%)" value={form.default_revshare_percent} onChange={(v) => set("default_revshare_percent", v)} hint="Aplicado a novos afiliados" />
          <NumberField label="CPA padrão (R$)" value={form.default_cpa_amount} onChange={(v) => set("default_cpa_amount", v)} hint="Valor fixo por referido qualificado" />
          <NumberField label="Depósito mínimo do CPA (R$)" value={form.cpa_min_deposit} onChange={(v) => set("cpa_min_deposit", v)} hint="Valor que qualifica o CPA" />
          <NumberField label="Sub-afiliado (%)" value={form.sub_affiliate_percent} onChange={(v) => set("sub_affiliate_percent", v)} hint="Percentual da rede indireta" />
        </div>
      </section>

      <section className={`${cardClass} p-5`}>
        <div className="mb-4 flex items-center gap-2">
          <Wallet className="h-4 w-4 text-[#f97316]" />
          <p className="text-sm font-semibold text-white">Regras de saque</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField label="Saque mínimo (R$)" value={form.min_withdrawal} onChange={(v) => set("min_withdrawal", v)} />
          <NumberField label="Taxa de saque (%)" value={form.withdrawal_fee_percent} onChange={(v) => set("withdrawal_fee_percent", v)} />
        </div>
      </section>

      <section className={`${cardClass} p-5`}>
        <div className="mb-4 flex items-center gap-2">
          <Wallet className="h-4 w-4 text-[#f97316]" />
          <p className="text-sm font-semibold text-white">Exibição no painel do afiliado</p>
        </div>
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-white/70">Moeda exibida</span>
              <select
                className={`${inputClass} w-full`}
                value={form.display_currency}
                onChange={(e) => set("display_currency", e.target.value === "USD" ? "USD" : "BRL")}
              >
                <option value="BRL">Real (R$)</option>
                <option value="USD">Dólar ($)</option>
              </select>
              <span className="text-[11px] text-white/30">Afeta todos os valores do painel do afiliado</span>
            </label>
            <NumberField
              label="Cotação do dólar (1 USD em R$)"
              value={form.usd_rate}
              onChange={(v) => set("usd_rate", v)}
              hint={
                form.display_currency === "USD"
                  ? "Os valores em real são divididos por esta cota��ão"
                  : "Usada apenas quando a moeda é dólar"
              }
            />
          </div>

          {form.display_currency === "USD" && (
            <p className="rounded-lg bg-[#0a0e17] px-3 py-2.5 text-[11px] text-white/40">
              {"Exemplo: um saldo de R$ 1.000,00 aparece como " +
                (form.usd_rate > 0
                  ? "$ " +
                    (1000 / form.usd_rate).toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  : "—") +
                " para o afiliado."}
            </p>
          )}

          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-white/70">Data do próximo pagamento</span>
            <input
              type="date"
              className={`${inputClass} w-full [color-scheme:dark]`}
              value={form.next_payment_date ?? ""}
              onChange={(e) => set("next_payment_date", e.target.value || null)}
            />
            <span className="text-[11px] text-white/30">
              Deixe em branco para o painel calcular automaticamente a próxima janela (dias 10-12 e 25-27).
            </span>
          </label>
          {form.next_payment_date && (
            <button
              type="button"
              onClick={() => set("next_payment_date", null)}
              className="self-start text-[11px] text-[#f97316] hover:underline"
            >
              Limpar data e voltar ao cálculo automático
            </button>
          )}
        </div>
      </section>

      <section className={`${cardClass} p-5`}>
        <div className="mb-4 flex items-center gap-2">
          <Settings2 className="h-4 w-4 text-[#f97316]" />
          <p className="text-sm font-semibold text-white">Programa</p>
        </div>
        <div className="flex flex-col gap-3">
          <Toggle
            label="Programa aberto para novos afiliados"
            hint="Desativado, ninguém consegue ativar o programa nem gerar comissão"
            checked={form.program_enabled}
            onChange={(v) => set("program_enabled", v)}
          />
          <Toggle
            label="Aprovar afiliados automaticamente"
            hint="Desativado, novos afiliados entram como pendentes"
            checked={form.auto_approve_affiliates}
            onChange={(v) => set("auto_approve_affiliates", v)}
          />
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="flex h-11 items-center gap-2 rounded-lg bg-[#f97316] px-6 text-sm font-medium text-white disabled:opacity-40"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Salvar configurações
        </button>
        <button
          type="button"
          onClick={applyToAll}
          disabled={applying}
          className="flex h-11 items-center gap-2 rounded-lg border border-[#1F2933] px-6 text-sm text-white/70 hover:bg-[#121826] hover:text-white disabled:opacity-40"
        >
          {applying && <Loader2 className="h-4 w-4 animate-spin" />}
          Aplicar padrão a todos os afiliados
        </button>
      </div>
      <p className="text-[11px] text-white/30">
        {settings.updated_at ? `Última atualização em ${dateTime(settings.updated_at)}.` : ""} Aplicar o padrão sobrescreve
        os valores individuais de CPA e RevShare de todos os afiliados.
      </p>
    </div>
  )
}

function NumberField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  hint?: string
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm text-white/70">{label}</span>
      <input
        className={`${inputClass} w-full`}
        value={String(value)}
        onChange={(e) => onChange(Number(e.target.value))}
        inputMode="decimal"
      />
      {hint && <span className="text-[11px] text-white/30">{hint}</span>}
    </label>
  )
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (value: boolean) => void
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg bg-[#0a0e17] p-4">
      <div className="min-w-0">
        <p className="text-sm text-white">{label}</p>
        {hint && <p className="text-[11px] text-white/40">{hint}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${checked ? "bg-[#22c55e]" : "bg-[#1F2933]"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${checked ? "left-[22px]" : "left-0.5"}`}
        />
      </button>
    </div>
  )
}
