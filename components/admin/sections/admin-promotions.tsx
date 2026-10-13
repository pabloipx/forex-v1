"use client"

import { useCallback, useEffect, useState } from "react"
import {
  Check,
  Gift,
  Loader2,
  Lock,
  Pencil,
  Plus,
  RefreshCw,
  Ticket,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react"

// A autorizacao do painel e feita por cookie HttpOnly assinado, enviado automaticamente
// pelo navegador em requisicoes same-origin. Nenhum segredo trafega pelo bundle.
const ADMIN_TOKEN = ""

interface PromoCode {
  id: string
  code: string
  description: string | null
  bonus_type: "percent" | "fixed"
  bonus_value: number
  max_bonus: number | null
  min_deposit: number
  rollover_multiplier: number
  max_uses: number | null
  uses_count: number
  max_uses_per_user: number
  is_active: boolean
  starts_at: string | null
  expires_at: string | null
  total_bonus_granted: number
  active_bonuses: number
}

interface UserBonus {
  id: string
  code: string
  user_name: string
  user_email: string
  bonus_amount: number
  deposit_amount: number
  rollover_required: number
  rollover_progress: number
  status: "active" | "completed" | "cancelled"
  granted_at: string
  progress_percent: number
  remaining: number
}

/** Estado do formulario de campanha. Strings para os inputs se comportarem bem quando vazios. */
type FormState = {
  id?: string
  code: string
  description: string
  bonus_type: "percent" | "fixed"
  bonus_value: string
  max_bonus: string
  min_deposit: string
  rollover_multiplier: string
  max_uses: string
  max_uses_per_user: string
  is_active: boolean
  expires_at: string
}

const emptyForm: FormState = {
  code: "",
  description: "",
  bonus_type: "percent",
  bonus_value: "100",
  max_bonus: "",
  min_deposit: "50",
  rollover_multiplier: "1",
  max_uses: "",
  max_uses_per_user: "1",
  is_active: true,
  expires_at: "",
}

const brl = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v) || 0)

export function AdminPromotions() {
  const [view, setView] = useState<"codes" | "rollover">("codes")
  const [codes, setCodes] = useState<PromoCode[]>([])
  const [bonuses, setBonuses] = useState<UserBonus[]>([])
  const [totals, setTotals] = useState({ active: 0, total_granted: 0, locked: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [processing, setProcessing] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "completed" | "cancelled">("active")

  const fetchCodes = useCallback(async () => {
    const res = await fetch("/api/admin/promo-codes", { headers: { "x-admin-token": ADMIN_TOKEN } })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || "Erro ao carregar códigos")
    setCodes(data.codes || [])
  }, [])

  const fetchBonuses = useCallback(async () => {
    const query = statusFilter === "all" ? "" : `?status=${statusFilter}`
    const res = await fetch(`/api/admin/bonuses${query}`, { headers: { "x-admin-token": ADMIN_TOKEN } })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || "Erro ao carregar bônus")
    setBonuses(data.bonuses || [])
    setTotals(data.totals || { active: 0, total_granted: 0, locked: 0 })
  }, [statusFilter])

  const loadAll = useCallback(async () => {
    try {
      setLoading(true)
      setError("")
      await Promise.all([fetchCodes(), fetchBonuses()])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar dados")
    } finally {
      setLoading(false)
    }
  }, [fetchCodes, fetchBonuses])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const notify = (text: string) => {
    setMessage(text)
    setTimeout(() => setMessage(""), 4000)
  }

  const openEdit = (c: PromoCode) => {
    setForm({
      id: c.id,
      code: c.code,
      description: c.description || "",
      bonus_type: c.bonus_type,
      bonus_value: String(c.bonus_value),
      max_bonus: c.max_bonus != null ? String(c.max_bonus) : "",
      min_deposit: String(c.min_deposit),
      rollover_multiplier: String(c.rollover_multiplier),
      max_uses: c.max_uses != null ? String(c.max_uses) : "",
      max_uses_per_user: String(c.max_uses_per_user),
      is_active: c.is_active,
      // input datetime-local nao aceita fuso: corta os segundos e o Z.
      expires_at: c.expires_at ? c.expires_at.slice(0, 16) : "",
    })
    setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.code.trim()) {
      setError("Informe o código.")
      return
    }

    setSaving(true)
    setError("")
    try {
      const res = await fetch("/api/admin/promo-codes", {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": ADMIN_TOKEN },
        body: JSON.stringify({
          ...form,
          expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro ao salvar")

      notify(form.id ? "Campanha atualizada." : "Campanha criada.")
      setShowForm(false)
      setForm(emptyForm)
      await fetchCodes()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar")
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (c: PromoCode) => {
    setProcessing(c.id)
    try {
      const res = await fetch("/api/admin/promo-codes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-token": ADMIN_TOKEN },
        body: JSON.stringify({ id: c.id, is_active: !c.is_active }),
      })
      if (!res.ok) throw new Error("Erro ao alterar status")
      await fetchCodes()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao alterar status")
    } finally {
      setProcessing(null)
    }
  }

  const handleDelete = async (c: PromoCode) => {
    if (!confirm(`Excluir a campanha ${c.code}?`)) return
    setProcessing(c.id)
    setError("")
    try {
      const res = await fetch(`/api/admin/promo-codes?id=${c.id}`, {
        method: "DELETE",
        headers: { "x-admin-token": ADMIN_TOKEN },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro ao excluir")
      notify("Campanha excluída.")
      await fetchCodes()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir")
    } finally {
      setProcessing(null)
    }
  }

  const handleBonusAction = async (bonusId: string, action: "complete" | "cancel" | "recalc") => {
    const confirmations: Record<string, string> = {
      complete: "Liberar este bônus, perdoando o rollover restante?",
      cancel: "Cancelar este bônus e remover o valor travado do saldo do usuário?",
    }
    if (confirmations[action] && !confirm(confirmations[action])) return

    setProcessing(bonusId)
    setError("")
    try {
      const res = await fetch("/api/admin/bonuses", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": ADMIN_TOKEN },
        body: JSON.stringify({ bonusId, action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Erro na ação")
      notify(data.message || "Ação concluída.")
      await Promise.all([fetchBonuses(), fetchCodes()])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro na ação")
    } finally {
      setProcessing(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Gift className="w-6 h-6 text-orange-500" />
            Promoções e Bônus
          </h1>
          <p className="text-gray-400 text-sm mt-1">Códigos promocionais e controle de rollover</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadAll}
            className="flex items-center gap-2 px-4 py-2 bg-[#1A1F2E] text-gray-300 rounded-lg hover:bg-[#232A3A]"
          >
            <RefreshCw className="w-4 h-4" />
            Atualizar
          </button>
          <button
            onClick={() => {
              setForm(emptyForm)
              setShowForm(true)
            }}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-medium"
          >
            <Plus className="w-4 h-4" />
            Nova campanha
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/40 rounded-lg text-red-400 text-sm">{error}</div>
      )}
      {message && (
        <div className="mb-4 p-4 bg-green-500/10 border border-green-500/40 rounded-lg text-green-400 text-sm">
          {message}
        </div>
      )}

      {/* Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="bg-[#131A24] border border-[#1E2633] rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <Ticket className="w-4 h-4" />
            Campanhas ativas
          </div>
          <p className="text-2xl font-bold text-white mt-2">{codes.filter((c) => c.is_active).length}</p>
        </div>
        <div className="bg-[#131A24] border border-[#1E2633] rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <TrendingUp className="w-4 h-4" />
            Bônus concedido
          </div>
          <p className="text-2xl font-bold text-white mt-2">{brl(totals.total_granted)}</p>
        </div>
        <div className="bg-[#131A24] border border-[#1E2633] rounded-xl p-4">
          <div className="flex items-center gap-2 text-gray-400 text-sm">
            <Lock className="w-4 h-4" />
            Travado em rollover
          </div>
          <p className="text-2xl font-bold text-orange-500 mt-2">{brl(totals.locked)}</p>
        </div>
      </div>

      {/* Alternancia entre campanhas e rollover */}
      <div className="flex gap-2 mb-4 border-b border-[#1E2633]">
        {[
          { id: "codes" as const, label: "Campanhas" },
          { id: "rollover" as const, label: "Rollover dos usuários" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setView(tab.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              view === tab.id
                ? "border-orange-500 text-orange-500"
                : "border-transparent text-gray-400 hover:text-gray-200"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {view === "codes" && (
        <div className="bg-[#131A24] border border-[#1E2633] rounded-xl overflow-hidden">
          {codes.length === 0 ? (
            <p className="p-8 text-center text-gray-500">Nenhuma campanha criada.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-[#0F151E] text-gray-400">
                  <tr>
                    <th className="text-left p-4 font-medium">Código</th>
                    <th className="text-left p-4 font-medium">Bônus</th>
                    <th className="text-left p-4 font-medium">Mín. depósito</th>
                    <th className="text-left p-4 font-medium">Rollover</th>
                    <th className="text-left p-4 font-medium">Usos</th>
                    <th className="text-left p-4 font-medium">Custo</th>
                    <th className="text-left p-4 font-medium">Status</th>
                    <th className="text-right p-4 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {codes.map((c) => (
                    <tr key={c.id} className="border-t border-[#1E2633]">
                      <td className="p-4">
                        <p className="text-white font-mono font-semibold">{c.code}</p>
                        {c.description && <p className="text-gray-500 text-xs mt-1">{c.description}</p>}
                      </td>
                      <td className="p-4 text-gray-300">
                        {c.bonus_type === "percent" ? `${Number(c.bonus_value)}%` : brl(c.bonus_value)}
                        {c.max_bonus != null && (
                          <span className="block text-gray-500 text-xs">até {brl(c.max_bonus)}</span>
                        )}
                      </td>
                      <td className="p-4 text-gray-300">{brl(c.min_deposit)}</td>
                      <td className="p-4 text-gray-300">{Number(c.rollover_multiplier)}x</td>
                      <td className="p-4 text-gray-300">
                        {c.uses_count}
                        {c.max_uses != null ? ` / ${c.max_uses}` : ""}
                      </td>
                      <td className="p-4 text-gray-300">{brl(c.total_bonus_granted)}</td>
                      <td className="p-4">
                        <button
                          onClick={() => toggleActive(c)}
                          disabled={processing === c.id}
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            c.is_active ? "bg-green-500/20 text-green-400" : "bg-gray-500/20 text-gray-400"
                          }`}
                        >
                          {c.is_active ? "Ativo" : "Inativo"}
                        </button>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEdit(c)}
                            className="p-2 bg-[#1A1F2E] text-gray-300 rounded-lg hover:bg-[#232A3A]"
                            aria-label={`Editar ${c.code}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(c)}
                            disabled={processing === c.id}
                            className="p-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 disabled:opacity-50"
                            aria-label={`Excluir ${c.code}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {view === "rollover" && (
        <div>
          <div className="flex flex-wrap gap-2 mb-4">
            {(["active", "completed", "cancelled", "all"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-sm ${
                  statusFilter === s ? "bg-orange-500 text-white" : "bg-[#1A1F2E] text-gray-400 hover:bg-[#232A3A]"
                }`}
              >
                {s === "active" ? "Ativos" : s === "completed" ? "Concluídos" : s === "cancelled" ? "Cancelados" : "Todos"}
              </button>
            ))}
          </div>

          <div className="bg-[#131A24] border border-[#1E2633] rounded-xl overflow-hidden">
            {bonuses.length === 0 ? (
              <p className="p-8 text-center text-gray-500">Nenhum bônus neste filtro.</p>
            ) : (
              <div className="divide-y divide-[#1E2633]">
                {bonuses.map((b) => (
                  <div key={b.id} className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-white font-medium truncate">{b.user_name}</p>
                        <p className="text-gray-500 text-xs truncate">{b.user_email}</p>
                        <p className="text-gray-400 text-xs mt-1">
                          <span className="font-mono text-orange-500">{b.code}</span> · bônus {brl(b.bonus_amount)} ·
                          depósito {brl(b.deposit_amount)}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            b.status === "active"
                              ? "bg-orange-500/20 text-orange-400"
                              : b.status === "completed"
                                ? "bg-green-500/20 text-green-400"
                                : "bg-gray-500/20 text-gray-400"
                          }`}
                        >
                          {b.status === "active" ? "Em rollover" : b.status === "completed" ? "Liberado" : "Cancelado"}
                        </span>

                        {b.status === "active" && (
                          <>
                            <button
                              onClick={() => handleBonusAction(b.id, "recalc")}
                              disabled={processing === b.id}
                              className="p-2 bg-[#1A1F2E] text-gray-300 rounded-lg hover:bg-[#232A3A] disabled:opacity-50"
                              aria-label="Recalcular progresso"
                            >
                              <RefreshCw className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleBonusAction(b.id, "complete")}
                              disabled={processing === b.id}
                              className="p-2 bg-green-500/10 text-green-400 rounded-lg hover:bg-green-500/20 disabled:opacity-50"
                              aria-label="Liberar bônus"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleBonusAction(b.id, "cancel")}
                              disabled={processing === b.id}
                              className="p-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20 disabled:opacity-50"
                              aria-label="Cancelar bônus"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                        <span>
                          Volume: {brl(b.rollover_progress)} de {brl(b.rollover_required)}
                        </span>
                        <span>{b.progress_percent}%</span>
                      </div>
                      <div className="h-2 bg-[#0F151E] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${b.status === "active" ? "bg-orange-500" : "bg-green-500"}`}
                          style={{ width: `${b.progress_percent}%` }}
                        />
                      </div>
                      {b.status === "active" && b.remaining > 0 && (
                        <p className="text-gray-500 text-xs mt-1">Faltam {brl(b.remaining)} de volume</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Formulario de campanha */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#131A24] border border-[#1E2633] rounded-xl w-full max-w-2xl my-8">
            <div className="flex items-center justify-between p-4 border-b border-[#1E2633]">
              <h2 className="text-lg font-semibold text-white">
                {form.id ? "Editar campanha" : "Nova campanha"}
              </h2>
              <button onClick={() => setShowForm(false)} aria-label="Fechar">
                <X className="w-5 h-5 text-gray-400 hover:text-white" />
              </button>
            </div>

            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-gray-400 text-sm mb-1">Código</label>
                <input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="BEMVINDO100"
                  className="w-full px-3 py-2 bg-[#0F151E] border border-[#1E2633] rounded-lg text-white font-mono focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-gray-400 text-sm mb-1">Descrição</label>
                <input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="100% de bônus no primeiro depósito"
                  className="w-full px-3 py-2 bg-[#0F151E] border border-[#1E2633] rounded-lg text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-1">Tipo de bônus</label>
                <select
                  value={form.bonus_type}
                  onChange={(e) => setForm({ ...form, bonus_type: e.target.value as "percent" | "fixed" })}
                  className="w-full px-3 py-2 bg-[#0F151E] border border-[#1E2633] rounded-lg text-white focus:outline-none focus:border-orange-500"
                >
                  <option value="percent">Porcentagem do depósito</option>
                  <option value="fixed">Valor fixo</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-1">
                  {form.bonus_type === "percent" ? "Porcentagem (%)" : "Valor (R$)"}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.bonus_value}
                  onChange={(e) => setForm({ ...form, bonus_value: e.target.value })}
                  className="w-full px-3 py-2 bg-[#0F151E] border border-[#1E2633] rounded-lg text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-1">Bônus máximo (R$)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.max_bonus}
                  onChange={(e) => setForm({ ...form, max_bonus: e.target.value })}
                  placeholder="sem limite"
                  className="w-full px-3 py-2 bg-[#0F151E] border border-[#1E2633] rounded-lg text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-1">Depósito mínimo (R$)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.min_deposit}
                  onChange={(e) => setForm({ ...form, min_deposit: e.target.value })}
                  className="w-full px-3 py-2 bg-[#0F151E] border border-[#1E2633] rounded-lg text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-1">Multiplicador de rollover</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={form.rollover_multiplier}
                  onChange={(e) => setForm({ ...form, rollover_multiplier: e.target.value })}
                  className="w-full px-3 py-2 bg-[#0F151E] border border-[#1E2633] rounded-lg text-white focus:outline-none focus:border-orange-500"
                />
                <p className="text-gray-500 text-xs mt-1">Volume exigido = bônus x multiplicador. 0 libera na hora.</p>
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-1">Limite total de usos</label>
                <input
                  type="number"
                  min="0"
                  value={form.max_uses}
                  onChange={(e) => setForm({ ...form, max_uses: e.target.value })}
                  placeholder="ilimitado"
                  className="w-full px-3 py-2 bg-[#0F151E] border border-[#1E2633] rounded-lg text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-1">Usos por usuário</label>
                <input
                  type="number"
                  min="1"
                  value={form.max_uses_per_user}
                  onChange={(e) => setForm({ ...form, max_uses_per_user: e.target.value })}
                  className="w-full px-3 py-2 bg-[#0F151E] border border-[#1E2633] rounded-lg text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-1">Expira em</label>
                <input
                  type="datetime-local"
                  value={form.expires_at}
                  onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
                  className="w-full px-3 py-2 bg-[#0F151E] border border-[#1E2633] rounded-lg text-white focus:outline-none focus:border-orange-500"
                />
              </div>

              <div className="sm:col-span-2 flex items-center gap-2">
                <input
                  id="promo-active"
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="w-4 h-4 accent-orange-500"
                />
                <label htmlFor="promo-active" className="text-gray-300 text-sm">
                  Campanha ativa
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 p-4 border-t border-[#1E2633]">
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-[#1A1F2E] text-gray-300 rounded-lg hover:bg-[#232A3A]"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 font-medium disabled:opacity-50"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
