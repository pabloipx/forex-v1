"use client"

import { useEffect, useState } from "react"
import { Search, MoreVertical, Ban, CheckCircle, Edit, RefreshCw, DollarSign, AlertCircle } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Label } from "@/components/ui/label"

interface User {
  id: string
  email: string
  full_name: string
  phone: string
  is_blocked: boolean
  is_verified: boolean
  is_admin: boolean
  created_at: string
  balance_real: number
  balance_demo: number
}

const ADMIN_PASSWORD = ""

export function AdminUsers() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState({
    full_name: "",
    phone: "",
    balance_real: "",
    balance_demo: "",
    is_blocked: false,
    is_verified: false,
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/admin/users", {
        headers: {
          "x-admin-token": ADMIN_PASSWORD,
        },
      })
      const data = await response.json()

      if (!response.ok) {
        setError(`Erro ${response.status}: ${data.error || "Falha ao carregar"} - ${data.details || ""}`)
        setUsers([])
        return
      }

      if (Array.isArray(data)) {
        setUsers(data)
      } else {
        setError("Formato de resposta inválido")
        setUsers([])
      }
    } catch (err) {
      setError(`Erro de conexão: ${String(err)}`)
      setUsers([])
    } finally {
      setLoading(false)
    }
  }

  const openEditModal = (user: User) => {
    setSelectedUser(user)
    setEditForm({
      full_name: user.full_name || "",
      phone: user.phone || "",
      balance_real: user.balance_real.toString(),
      balance_demo: user.balance_demo.toString(),
      is_blocked: user.is_blocked || false,
      is_verified: user.is_verified || false,
    })
    setShowEditModal(true)
  }

  const handleSaveUser = async () => {
    if (!selectedUser) return

    setSaving(true)
    try {
      const response = await fetch("/api/admin/users", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": ADMIN_PASSWORD,
        },
        body: JSON.stringify({
          userId: selectedUser.id,
          full_name: editForm.full_name,
          phone: editForm.phone,
          balance_real: editForm.balance_real,
          balance_demo: editForm.balance_demo,
          is_blocked: editForm.is_blocked,
          is_verified: editForm.is_verified,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to save user")
      }

      setShowEditModal(false)
      setSelectedUser(null)
      loadUsers()
    } catch (err) {
      alert("Erro ao salvar usuário")
    } finally {
      setSaving(false)
    }
  }

  const toggleBlockUser = async (user: User) => {
    try {
      const response = await fetch("/api/admin/users", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": ADMIN_PASSWORD,
        },
        body: JSON.stringify({
          userId: user.id,
          full_name: user.full_name,
          phone: user.phone,
          balance_real: user.balance_real,
          balance_demo: user.balance_demo,
          is_blocked: !user.is_blocked,
          is_verified: user.is_verified,
        }),
      })

      if (response.ok) {
        loadUsers()
      }
    } catch (err) {
      console.error("Error toggling user block:", err)
    }
  }

  const filteredUsers = users.filter(
    (user) =>
      user.email?.toLowerCase().includes(search.toLowerCase()) ||
      user.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      user.phone?.toLowerCase().includes(search.toLowerCase()),
  )

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value)
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-white">Usuários</h1>
          <p className="text-gray-400 text-sm mt-1">Gerencie os usuários ({users.length} total)</p>
        </div>
        <Button
          onClick={loadUsers}
          variant="outline"
          size="sm"
          className="border-[#2A3142] bg-transparent text-gray-300 hover:text-white w-full sm:w-auto"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-400 font-medium">Erro ao carregar usuários</p>
            <p className="text-red-400/70 text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
        <Input
          placeholder="Buscar por email, nome ou telefone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10 bg-[#0D1117] border-[#1E2430] text-white placeholder:text-gray-500"
        />
      </div>

      {/* Mobile Cards View */}
      <div className="block md:hidden space-y-3">
        {loading ? (
          <div className="text-center text-gray-500 py-8">Carregando...</div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            {error ? "Erro ao carregar" : "Nenhum usuário encontrado"}
          </div>
        ) : (
          filteredUsers.map((user) => (
            <div key={user.id} className="bg-[#0D1117] border border-[#1E2430] rounded-xl p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="text-white font-medium truncate">{user.full_name || "Sem nome"}</div>
                  <div className="text-gray-500 text-sm truncate">{user.email}</div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white -mr-2">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-[#1E2430] border-[#2A3142]">
                    <DropdownMenuItem
                      onClick={() => openEditModal(user)}
                      className="text-gray-300 hover:text-white hover:bg-[#2A3142]"
                    >
                      <Edit className="w-4 h-4 mr-2" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuSeparator className="bg-[#2A3142]" />
                    <DropdownMenuItem
                      onClick={() => toggleBlockUser(user)}
                      className={
                        user.is_blocked
                          ? "text-green-400 hover:text-green-300 hover:bg-[#2A3142]"
                          : "text-red-400 hover:text-red-300 hover:bg-[#2A3142]"
                      }
                    >
                      {user.is_blocked ? (
                        <>
                          <CheckCircle className="w-4 h-4 mr-2" />
                          Desbloquear
                        </>
                      ) : (
                        <>
                          <Ban className="w-4 h-4 mr-2" />
                          Bloquear
                        </>
                      )}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500">Real:</span>
                  <span className="text-green-500 font-semibold ml-1">{formatCurrency(user.balance_real)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Demo:</span>
                  <span className="text-gray-400 ml-1">{formatCurrency(user.balance_demo)}</span>
                </div>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#1E2430]">
                <span className="text-gray-500 text-xs">{new Date(user.created_at).toLocaleDateString("pt-BR")}</span>
                {user.is_blocked ? (
                  <span className="px-2 py-0.5 rounded-full text-xs bg-red-500/20 text-red-400">Bloqueado</span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-xs bg-green-500/20 text-green-400">Ativo</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block bg-[#0D1117] border border-[#1E2430] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1E2430]">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                  Usuário
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                  Saldo Real
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                  Saldo Demo
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                  Status
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                  Cadastro
                </th>
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
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    {error ? "Erro ao carregar" : "Nenhum usuário encontrado"}
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-[#1E2430]/50">
                    <td className="px-4 py-3">
                      <div>
                        <div className="text-white font-medium">{user.full_name || "Sem nome"}</div>
                        <div className="text-gray-500 text-sm">{user.email}</div>
                        {user.phone && <div className="text-gray-600 text-xs">{user.phone}</div>}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-green-500 font-semibold">{formatCurrency(user.balance_real)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-400">{formatCurrency(user.balance_demo)}</span>
                    </td>
                    <td className="px-4 py-3">
                      {user.is_blocked ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-500/20 text-red-400">
                          Bloqueado
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-500/20 text-green-400">
                          Ativo
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-sm">
                      {new Date(user.created_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-[#1E2430] border-[#2A3142]">
                          <DropdownMenuItem
                            onClick={() => openEditModal(user)}
                            className="text-gray-300 hover:text-white hover:bg-[#2A3142]"
                          >
                            <Edit className="w-4 h-4 mr-2" />
                            Editar Usuário
                          </DropdownMenuItem>
                          <DropdownMenuSeparator className="bg-[#2A3142]" />
                          <DropdownMenuItem
                            onClick={() => toggleBlockUser(user)}
                            className={
                              user.is_blocked
                                ? "text-green-400 hover:text-green-300 hover:bg-[#2A3142]"
                                : "text-red-400 hover:text-red-300 hover:bg-[#2A3142]"
                            }
                          >
                            {user.is_blocked ? (
                              <>
                                <CheckCircle className="w-4 h-4 mr-2" />
                                Desbloquear
                              </>
                            ) : (
                              <>
                                <Ban className="w-4 h-4 mr-2" />
                                Bloquear
                              </>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#0D1117] border border-[#1E2430] rounded-xl p-4 md:p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg md:text-xl font-bold text-white mb-4 md:mb-6">Editar Usuário</h3>

            <div className="space-y-4">
              <div className="bg-[#1E2430]/50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-400 mb-3">Informações Pessoais</h4>
                <div className="space-y-3">
                  <div>
                    <Label className="text-gray-400 text-sm">Nome Completo</Label>
                    <Input
                      value={editForm.full_name}
                      onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                      className="mt-1 bg-[#0D1117] border-[#2A3142] text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-400 text-sm">Telefone</Label>
                    <Input
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      className="mt-1 bg-[#0D1117] border-[#2A3142] text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-[#1E2430]/50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Saldos
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-gray-400 text-sm">Saldo Real (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={editForm.balance_real}
                      onChange={(e) => setEditForm({ ...editForm, balance_real: e.target.value })}
                      className="mt-1 bg-[#0D1117] border-[#2A3142] text-green-500 font-semibold"
                    />
                  </div>
                  <div>
                    <Label className="text-gray-400 text-sm">Saldo Demo (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={editForm.balance_demo}
                      onChange={(e) => setEditForm({ ...editForm, balance_demo: e.target.value })}
                      className="mt-1 bg-[#0D1117] border-[#2A3142] text-gray-400"
                    />
                  </div>
                </div>
              </div>

              <div className="bg-[#1E2430]/50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-400 mb-3">Status da Conta</h4>
                <div className="space-y-3">
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-white text-sm">Conta Verificada</span>
                    <div
                      onClick={() => setEditForm({ ...editForm, is_verified: !editForm.is_verified })}
                      className={`w-12 h-6 rounded-full transition-colors ${editForm.is_verified ? "bg-green-600" : "bg-gray-600"}`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform mt-0.5 ${editForm.is_verified ? "translate-x-6 ml-0.5" : "translate-x-0.5"}`}
                      />
                    </div>
                  </label>
                  <label className="flex items-center justify-between cursor-pointer">
                    <span className="text-white text-sm">Conta Bloqueada</span>
                    <div
                      onClick={() => setEditForm({ ...editForm, is_blocked: !editForm.is_blocked })}
                      className={`w-12 h-6 rounded-full transition-colors ${editForm.is_blocked ? "bg-red-600" : "bg-gray-600"}`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform mt-0.5 ${editForm.is_blocked ? "translate-x-6 ml-0.5" : "translate-x-0.5"}`}
                      />
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                onClick={() => setShowEditModal(false)}
                variant="outline"
                className="flex-1 border-[#2A3142] bg-transparent text-gray-300 hover:text-white"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSaveUser}
                disabled={saving}
                className="flex-1 bg-gradient-to-r from-[#f97316] to-[#fb923c] hover:from-[#c2410c] hover:to-[#f97316] text-white"
              >
                {saving ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
