"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Search, CheckCircle, XCircle, RefreshCw, History, User, Trash2, TrendingUp, TrendingDown } from "lucide-react"

interface Trade {
  id: string
  user_id: string
  symbol: string
  direction: string
  amount: number
  payout_percentage: number
  result: string
  profit: number
  timeframe: number
  created_at: string
  exit_time: string
  is_demo: boolean
  is_manually_adjusted?: boolean
  adjusted_by?: string
  adjusted_at?: string
}

interface UserOption {
  id: string
  email: string
  full_name: string
}

interface TradeEditorProps {
  users: UserOption[]
  onRefresh: () => void
}

export function TradeEditor({ users, onRefresh }: TradeEditorProps) {
  const [selectedUserId, setSelectedUserId] = useState<string>("")
  const [userSearch, setUserSearch] = useState("")
  const [trades, setTrades] = useState<Trade[]>([])
  const [userBalance, setUserBalance] = useState({ balance_real: 0, balance_demo: 0 })
  const [loading, setLoading] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [clearing, setClearing] = useState(false)

  const [editingTradeId, setEditingTradeId] = useState<string | null>(null)
  const [savingTradeId, setSavingTradeId] = useState<string | null>(null)

  const filteredUsers = users.filter(
    (u) =>
      u.email?.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.full_name?.toLowerCase().includes(userSearch.toLowerCase()),
  )

  const loadUserTrades = async (userId: string) => {
    if (!userId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/trades/edit?userId=${userId}`, {
        headers: { "x-admin-token": "" },
      })
      const data = await res.json()
      if (data.trades) {
        setTrades(data.trades)
        setUserBalance(data.balance || { balance_real: 0, balance_demo: 0 })
      }
    } catch (error) {
      console.error("Erro ao carregar trades:", error)
    } finally {
      setLoading(false)
    }
  }

  const selectUser = (userId: string) => {
    setSelectedUserId(userId)
    loadUserTrades(userId)
  }

  const saveTradeResult = async (trade: Trade, newResult: "win" | "loss") => {
    setSavingTradeId(trade.id)
    try {
      const res = await fetch("/api/admin/trades/edit", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": "",
        },
        body: JSON.stringify({
          tradeId: trade.id,
          userId: trade.user_id,
          newResult: newResult,
          newAmount: trade.amount,
          newDirection: trade.direction,
          newTimeframe: trade.timeframe,
          newCreatedAt: trade.created_at,
          adminEmail: "admin@admin.com",
        }),
      })

      const data = await res.json()

      if (data.success) {
        // Atualizar a lista localmente para feedback imediato
        setTrades((prev) =>
          prev.map((t) => {
            if (t.id === trade.id) {
              const payout = t.payout_percentage || 0.95
              const payoutMultiplier = payout > 1 ? payout / 100 : payout
              const newProfit = newResult === "win" ? Math.round(t.amount * payoutMultiplier * 100) / 100 : -t.amount
              return { ...t, result: newResult, profit: newProfit, is_manually_adjusted: true }
            }
            return t
          }),
        )

        // Atualizar saldo
        if (data.newBalance !== undefined) {
          if (trade.is_demo) {
            setUserBalance((prev) => ({ ...prev, balance_demo: data.newBalance }))
          } else {
            setUserBalance((prev) => ({ ...prev, balance_real: data.newBalance }))
          }
        }

        onRefresh()
      } else {
        alert("Erro: " + data.error)
      }
    } catch (error) {
      alert("Erro ao salvar alteração")
    } finally {
      setSavingTradeId(null)
    }
  }

  const handleClearHistory = async () => {
    if (!selectedUserId) return

    setClearing(true)
    try {
      const res = await fetch(`/api/admin/trades/edit?userId=${selectedUserId}`, {
        method: "DELETE",
        headers: { "x-admin-token": "" },
      })

      const data = await res.json()

      if (data.success) {
        alert("Histórico limpo com sucesso!")
        setShowClearConfirm(false)
        loadUserTrades(selectedUserId)
        onRefresh()
      } else {
        alert("Erro: " + data.error)
      }
    } catch (error) {
      alert("Erro ao limpar histórico")
    } finally {
      setClearing(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleString("pt-BR")
  }

  const calculateExpectedProfit = (trade: Trade, result: "win" | "loss") => {
    const payout = trade.payout_percentage || 0.95
    const payoutMultiplier = payout > 1 ? payout / 100 : payout
    if (result === "win") {
      return Math.round(trade.amount * payoutMultiplier * 100) / 100
    }
    return -trade.amount
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-adm-fg">Editar Operações</h2>
          <p className="text-sm text-adm-muted">Clique em WIN ou LOSS para alterar o resultado rapidamente</p>
        </div>
      </div>

      {/* Seleção de Usuário */}
      <div className="bg-adm-surface rounded-xl p-4 border border-adm-line">
        <h3 className="text-sm font-medium text-adm-fg/80 mb-3 flex items-center gap-2">
          <User className="w-4 h-4" />
          Selecionar Usuário
        </h3>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-adm-muted" />
          <Input
            placeholder="Buscar por email ou nome..."
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            className="pl-10 bg-adm-elevated border-adm-line text-adm-fg"
          />
        </div>

        {userSearch && (
          <div className="max-h-48 overflow-y-auto space-y-1">
            {filteredUsers.map((user) => (
              <button
                key={user.id}
                onClick={() => {
                  selectUser(user.id)
                  setUserSearch("")
                }}
                className={`w-full text-left p-3 rounded-lg transition-colors ${
                  selectedUserId === user.id
                    ? "bg-adm-accent/20 border border-adm-accent"
                    : "bg-adm-elevated hover:bg-adm-line"
                }`}
              >
                <p className="text-sm font-medium text-adm-fg">{user.full_name || "Sem nome"}</p>
                <p className="text-xs text-adm-muted">{user.email}</p>
              </button>
            ))}
          </div>
        )}

        {selectedUserId && (
          <div className="mt-3 p-3 bg-adm-elevated rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-adm-fg/80">
                  <span className="text-adm-muted">Usuário:</span> {users.find((u) => u.id === selectedUserId)?.email}
                </p>
                <div className="flex gap-4 mt-2">
                  <p className="text-xs text-adm-muted">
                    Saldo Real:{" "}
                    <span className="text-adm-accent-soft font-medium">{formatCurrency(userBalance.balance_real)}</span>
                  </p>
                  <p className="text-xs text-adm-muted">
                    Saldo Demo:{" "}
                    <span className="text-adm-accent-soft font-medium">{formatCurrency(userBalance.balance_demo)}</span>
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowClearConfirm(true)}
                className="border-red-600/50 text-red-400 hover:bg-red-600/20"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Limpar
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Lista de Trades */}
      {selectedUserId && (
        <div className="bg-adm-surface rounded-xl border border-adm-line">
          <div className="p-4 border-b border-adm-line flex items-center justify-between">
            <h3 className="text-sm font-medium text-adm-fg/80 flex items-center gap-2">
              <History className="w-4 h-4" />
              Operações ({trades.length})
            </h3>
            <Button
              size="sm"
              variant="outline"
              onClick={() => loadUserTrades(selectedUserId)}
              className="border-adm-line"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>

          {loading ? (
            <div className="p-8 text-center">
              <RefreshCw className="w-6 h-6 animate-spin mx-auto text-adm-muted" />
              <p className="text-sm text-adm-muted mt-2">Carregando...</p>
            </div>
          ) : trades.length === 0 ? (
            <div className="p-8 text-center text-adm-muted">Nenhuma operação encontrada</div>
          ) : (
            <div className="max-h-[500px] overflow-y-auto divide-y divide-zinc-800">
              {trades.map((trade) => {
                const isSaving = savingTradeId === trade.id
                const expectedWinProfit = calculateExpectedProfit(trade, "win")
                const expectedLossProfit = calculateExpectedProfit(trade, "loss")

                return (
                  <div
                    key={trade.id}
                    className={`p-4 hover:bg-adm-elevated/50 transition-colors ${
                      trade.is_manually_adjusted ? "bg-yellow-900/10" : ""
                    } ${isSaving ? "opacity-50 pointer-events-none" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-4">
                      {/* Info da operação */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-adm-fg">{trade.symbol}</span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded flex items-center gap-1 ${
                              trade.direction === "call"
                                ? "bg-adm-accent/20 text-adm-accent-soft"
                                : "bg-red-600/20 text-red-400"
                            }`}
                          >
                            {trade.direction === "call" ? (
                              <TrendingUp className="w-3 h-3" />
                            ) : (
                              <TrendingDown className="w-3 h-3" />
                            )}
                            {trade.direction === "call" ? "COMPRA" : "VENDA"}
                          </span>
                          {trade.is_demo && (
                            <span className="text-xs px-2 py-0.5 rounded bg-adm-accent/20 text-adm-accent-soft">DEMO</span>
                          )}
                          {trade.is_manually_adjusted && (
                            <span className="text-xs px-2 py-0.5 rounded bg-yellow-600/20 text-yellow-400">
                              AJUSTADO
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-adm-muted mt-1">
                          {formatDate(trade.created_at)} • {formatCurrency(trade.amount)}
                        </p>
                      </div>

                      {/* Resultado atual e valor */}
                      <div className="text-right mr-4">
                        <p
                          className={`text-sm font-medium ${
                            trade.result === "win"
                              ? "text-adm-accent-soft"
                              : trade.result === "loss"
                                ? "text-red-400"
                                : "text-yellow-400"
                          }`}
                        >
                          {trade.result === "win" ? "GANHOU" : trade.result === "loss" ? "PERDEU" : "PENDENTE"}
                        </p>
                        <p
                          className={`text-xs ${
                            trade.profit > 0 ? "text-adm-accent-soft" : trade.profit < 0 ? "text-red-400" : "text-adm-muted"
                          }`}
                        >
                          {trade.profit > 0 ? "+" : ""}
                          {formatCurrency(trade.profit || 0)}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => saveTradeResult(trade, "win")}
                          disabled={isSaving}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1 ${
                            trade.result === "win"
                              ? "bg-adm-accent text-adm-fg"
                              : "bg-adm-elevated text-adm-muted hover:bg-adm-accent-strong/20 hover:text-adm-accent-soft border border-adm-line hover:border-adm-accent"
                          }`}
                          title={`Marcar como WIN (+${formatCurrency(expectedWinProfit)})`}
                        >
                          {isSaving ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle className="w-4 h-4" />
                          )}
                          WIN
                        </button>
                        <button
                          onClick={() => saveTradeResult(trade, "loss")}
                          disabled={isSaving}
                          className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-1 ${
                            trade.result === "loss"
                              ? "bg-red-600 text-adm-fg"
                              : "bg-adm-elevated text-adm-muted hover:bg-red-600/20 hover:text-red-400 border border-adm-line hover:border-red-600"
                          }`}
                          title={`Marcar como LOSS (${formatCurrency(expectedLossProfit)})`}
                        >
                          {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                          LOSS
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal de confirmação para limpar histórico */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-adm-surface rounded-xl border border-adm-line w-full max-w-md p-6">
            <div className="flex items-center gap-3 text-red-400 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-600/20 flex items-center justify-center">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-adm-fg">Limpar Histórico</h3>
                <p className="text-sm text-adm-muted">Esta ação não pode ser desfeita</p>
              </div>
            </div>

            <p className="text-adm-fg/80 mb-6">
              Tem certeza que deseja apagar <strong>todo o histórico</strong> deste usuário? Todas as {trades.length}{" "}
              operações serão excluídas permanentemente.
            </p>

            <div className="flex gap-3">
              <Button onClick={() => setShowClearConfirm(false)} variant="outline" className="flex-1 border-adm-line">
                Cancelar
              </Button>
              <Button onClick={handleClearHistory} disabled={clearing} className="flex-1 bg-red-600 hover:bg-red-700">
                {clearing ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                Excluir Tudo
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
