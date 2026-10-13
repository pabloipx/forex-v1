"use client"

import { useEffect, useState } from "react"
import { Edit2, Save, X } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"

interface Symbol {
  id: string
  symbol: string
  name: string
  category: string
  payout_percentage: number
  is_active: boolean
  base_price: number
  volatility: number
}

// A autorizacao do painel e feita por cookie HttpOnly assinado, enviado automaticamente
// pelo navegador em requisicoes same-origin. Nenhum segredo trafega pelo bundle.
const ADMIN_TOKEN = ""

export function AdminMarkets() {
  const [symbols, setSymbols] = useState<Symbol[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<Symbol>>({})

  useEffect(() => {
    loadSymbols()
  }, [])

  const loadSymbols = async () => {
    try {
      const res = await fetch("/api/admin/symbols", { headers: { "x-admin-token": ADMIN_TOKEN } })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Falha ao carregar ativos")
      setSymbols(json.symbols || [])
    } catch (error) {
      console.error("Error loading symbols:", error)
    } finally {
      setLoading(false)
    }
  }

  const patchSymbol = async (payload: Record<string, unknown>) => {
    const res = await fetch("/api/admin/symbols", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", "x-admin-token": ADMIN_TOKEN },
      body: JSON.stringify(payload),
    })
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      throw new Error(json.error || "Falha ao atualizar ativo")
    }
  }

  const toggleSymbolActive = async (id: string, isActive: boolean) => {
    try {
      await patchSymbol({ id, is_active: isActive })
      loadSymbols()
    } catch (error) {
      console.error("Error toggling symbol:", error)
    }
  }

  const startEditing = (symbol: Symbol) => {
    setEditingId(symbol.id)
    setEditForm(symbol)
  }

  const saveEdit = async () => {
    if (!editingId) return

    try {
      await patchSymbol({
        id: editingId,
        payout_percentage: editForm.payout_percentage,
        volatility: editForm.volatility,
        base_price: editForm.base_price,
      })

      setEditingId(null)
      setEditForm({})
      loadSymbols()
    } catch (error) {
      console.error("Error saving symbol:", error)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Mercados</h1>
          <p className="text-gray-400 mt-1">Gerencie os ativos disponíveis para trading</p>
        </div>
      </div>

      {/* Symbols Table */}
      <div className="bg-[#0D1117] border border-[#1E2430] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1E2430]">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                  Ativo
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                  Categoria
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                  Payout
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                  Volatilidade
                </th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                  Ativo
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
              ) : symbols.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    Nenhum ativo encontrado
                  </td>
                </tr>
              ) : (
                symbols.map((symbol) => (
                  <tr key={symbol.id} className="hover:bg-[#1E2430]/50">
                    <td className="px-4 py-3">
                      <div>
                        <div className="text-white font-medium">{symbol.symbol}</div>
                        <div className="text-gray-500 text-sm">{symbol.name}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-400 capitalize">{symbol.category}</span>
                    </td>
                    <td className="px-4 py-3">
                      {editingId === symbol.id ? (
                        <Input
                          type="number"
                          value={editForm.payout_percentage || ""}
                          onChange={(e) =>
                            setEditForm({ ...editForm, payout_percentage: Number.parseFloat(e.target.value) })
                          }
                          className="w-20 h-8 bg-[#1E2430] border-[#2A3142] text-white"
                        />
                      ) : (
                        <span className="text-green-500 font-medium">{symbol.payout_percentage}%</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editingId === symbol.id ? (
                        <Input
                          type="number"
                          step="0.0001"
                          value={editForm.volatility || ""}
                          onChange={(e) => setEditForm({ ...editForm, volatility: Number.parseFloat(e.target.value) })}
                          className="w-24 h-8 bg-[#1E2430] border-[#2A3142] text-white"
                        />
                      ) : (
                        <span className="text-gray-400">{symbol.volatility}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Switch
                        checked={symbol.is_active}
                        onCheckedChange={(checked) => toggleSymbolActive(symbol.id, checked)}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {editingId === symbol.id ? (
                        <div className="flex justify-end gap-2">
                          <Button onClick={saveEdit} size="sm" className="bg-green-600 hover:bg-green-700">
                            <Save className="w-4 h-4" />
                          </Button>
                          <Button
                            onClick={() => {
                              setEditingId(null)
                              setEditForm({})
                            }}
                            size="sm"
                            variant="outline"
                            className="border-[#2A3142] bg-transparent text-gray-300"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <Button
                          onClick={() => startEditing(symbol)}
                          size="sm"
                          variant="ghost"
                          className="text-gray-400 hover:text-white"
                        >
                          <Edit2 className="w-4 h-4" />
                        </Button>
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
