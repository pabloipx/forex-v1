"use client"

import { useEffect, useState } from "react"
import { CheckCircle, XCircle, Clock, Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

interface Withdrawal {
  id: string
  user_id: string
  amount: number
  status: string
  payment_method: string
  payment_details: any
  created_at: string
  user_email?: string
}

interface AdminWithdrawalsProps {
  onUpdate: () => void
}

// A autorizacao do painel e feita por cookie HttpOnly assinado, enviado automaticamente
// pelo navegador em requisicoes same-origin. Nenhum segredo trafega pelo bundle.
const ADMIN_TOKEN = ""

export function AdminWithdrawals({ onUpdate }: AdminWithdrawalsProps) {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<"all" | "pending" | "completed" | "rejected">("all")

  useEffect(() => {
    loadWithdrawals()
  }, [])

  const loadWithdrawals = async () => {
    try {
      const res = await fetch("/api/admin/data?type=withdrawals", { headers: { "x-admin-token": ADMIN_TOKEN } })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Falha ao carregar saques")

      setWithdrawals(
        (json.withdrawals || []).map((withdrawal: any) => ({
          ...withdrawal,
          user_email: withdrawal.user_email || "Desconhecido",
        })),
      )
    } catch (error) {
      console.error("Error loading withdrawals:", error)
    } finally {
      setLoading(false)
    }
  }

  const updateWithdrawalStatus = async (
    id: string,
    status: "completed" | "rejected",
    userId?: string,
    amount?: number,
  ) => {
    try {
      const res = await fetch("/api/admin/data", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": ADMIN_TOKEN },
        body: JSON.stringify({
          action: status === "completed" ? "approve_withdrawal" : "reject_withdrawal",
          data: { withdrawalId: id, userId, amount },
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || "Falha ao atualizar saque")

      loadWithdrawals()
      onUpdate()
    } catch (error) {
      console.error("Error updating withdrawal:", error)
    }
  }

  const normalizeStatus = (status: string) => {
    if (status === "approved" || status === "completed" || status === "paid") return "completed"
    if (status === "rejected" || status === "cancelled") return "rejected"
    return "pending"
  }

  const filteredWithdrawals = withdrawals.filter((withdrawal) => {
    const matchesSearch = withdrawal.user_email?.toLowerCase().includes(search.toLowerCase())
    const matchesFilter = filter === "all" || normalizeStatus(withdrawal.status) === filter
    return matchesSearch && matchesFilter
  })

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value)
  }

  const getStatusBadge = (status: string) => {
    switch (normalizeStatus(status)) {
      case "completed":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
            <CheckCircle className="w-3 h-3" />
            Pago
          </span>
        )
      case "rejected":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400">
            <XCircle className="w-3 h-3" />
            Rejeitado
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-500/20 text-yellow-400">
            <Clock className="w-3 h-3" />
            Pendente
          </span>
        )
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Saques</h1>
          <p className="text-gray-400 mt-1">Gerencie as solicitações de saque</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <Input
            placeholder="Buscar por email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-[#0D1117] border-[#1E2430] text-white placeholder:text-gray-500"
          />
        </div>
        <div className="flex gap-2">
          {(["all", "pending", "completed", "rejected"] as const).map((f) => (
            <Button
              key={f}
              onClick={() => setFilter(f)}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              className={
                filter === f
                  ? "bg-[#f97316] hover:bg-[#c2410c]"
                  : "border-[#2A3142] bg-transparent text-gray-300 hover:bg-[#1E2430]"
              }
            >
              {f === "all" ? "Todos" : f === "pending" ? "Pendentes" : f === "completed" ? "Pagos" : "Rejeitados"}
            </Button>
          ))}
        </div>
      </div>

      {/* Withdrawals Table */}
      <div className="bg-[#0D1117] border border-[#1E2430] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1E2430]">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                  Usuário
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                  Valor
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                  Chave PIX
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                  Status
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">Data</th>
                <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1E2430]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    Carregando...
                  </td>
                </tr>
              ) : filteredWithdrawals.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    Nenhum saque encontrado
                  </td>
                </tr>
              ) : (
                filteredWithdrawals.map((withdrawal) => (
                  <tr key={withdrawal.id} className="hover:bg-[#1E2430]/50">
                    <td className="px-4 py-3">
                      <span className="text-white">{withdrawal.user_email}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-red-500 font-medium">{formatCurrency(withdrawal.amount)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-400 text-sm font-mono">
                        {withdrawal.payment_details?.pix_key || "N/A"}
                      </span>
                    </td>
                    <td className="px-4 py-3">{getStatusBadge(withdrawal.status)}</td>
                    <td className="px-4 py-3 text-gray-400 text-sm">
                      {new Date(withdrawal.created_at).toLocaleString("pt-BR")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {normalizeStatus(withdrawal.status) === "pending" && (
                        <div className="flex justify-end gap-2">
                          <Button
                            onClick={() =>
                              updateWithdrawalStatus(withdrawal.id, "completed", withdrawal.user_id, withdrawal.amount)
                            }
                            size="sm"
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            Pagar
                          </Button>
                          <Button
                            onClick={() => updateWithdrawalStatus(withdrawal.id, "rejected")}
                            size="sm"
                            variant="outline"
                            className="border-red-500 text-red-500 hover:bg-red-500/10"
                          >
                            Rejeitar
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
