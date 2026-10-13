"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { RefreshCw, Search, TrendingUp, Layers, Check, Pencil } from "lucide-react"

// A autorizacao do painel e feita por cookie HttpOnly assinado, enviado automaticamente
// pelo navegador em requisicoes same-origin. Nenhum segredo trafega pelo bundle.
const ADMIN_TOKEN = ""

interface AdminAsset {
  symbol: string
  name: string
  category: "forex" | "crypto" | "stocks"
  payout: number
  logo: string
  enabled: boolean
  sortOrder: number
}

const CATEGORY_LABELS: Record<string, string> = {
  forex: "Forex",
  crypto: "Cripto",
  stocks: "Ações",
}

export function AdminAssets() {
  const [assets, setAssets] = useState<AdminAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [savingSymbol, setSavingSymbol] = useState<string | null>(null)
  // Controle da edição de payout por ativo.
  const [editingSymbol, setEditingSymbol] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const [savingPayout, setSavingPayout] = useState<string | null>(null)
  const [savedSymbol, setSavedSymbol] = useState<string | null>(null)

  const fetchAssets = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/assets", { headers: { "x-admin-token": ADMIN_TOKEN } })
      const data = await res.json()
      if (res.ok) setAssets(data.assets || [])
    } catch (e) {
      console.error("[v0] erro ao carregar ativos", e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAssets()
  }, [])

  const toggleAsset = async (symbol: string, enabled: boolean) => {
    // Atualização otimista
    setAssets((prev) => prev.map((a) => (a.symbol === symbol ? { ...a, enabled } : a)))
    setSavingSymbol(symbol)
    try {
      const res = await fetch("/api/admin/assets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-token": ADMIN_TOKEN },
        body: JSON.stringify({ symbol, enabled }),
      })
      if (!res.ok) throw new Error("falha")
    } catch (e) {
      // Reverte em caso de erro
      setAssets((prev) => prev.map((a) => (a.symbol === symbol ? { ...a, enabled: !enabled } : a)))
    } finally {
      setSavingSymbol(null)
    }
  }

  const startEditPayout = (symbol: string, current: number) => {
    setEditingSymbol(symbol)
    setEditValue(String(current))
  }

  const cancelEditPayout = () => {
    setEditingSymbol(null)
    setEditValue("")
  }

  const savePayout = async (symbol: string) => {
    const value = Math.round(Number(editValue))
    if (!Number.isFinite(value) || value < 1 || value > 100) return

    const previous = assets.find((a) => a.symbol === symbol)?.payout
    // Atualização otimista
    setAssets((prev) => prev.map((a) => (a.symbol === symbol ? { ...a, payout: value } : a)))
    setEditingSymbol(null)
    setSavingPayout(symbol)
    try {
      const res = await fetch("/api/admin/assets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-token": ADMIN_TOKEN },
        body: JSON.stringify({ symbol, payout: value }),
      })
      if (!res.ok) throw new Error("falha")
      setSavedSymbol(symbol)
      setTimeout(() => setSavedSymbol((s) => (s === symbol ? null : s)), 1500)
    } catch (e) {
      // Reverte em caso de erro
      if (previous !== undefined) {
        setAssets((prev) => prev.map((a) => (a.symbol === symbol ? { ...a, payout: previous } : a)))
      }
    } finally {
      setSavingPayout(null)
    }
  }

  const filtered = assets.filter(
    (a) => a.name.toLowerCase().includes(search.toLowerCase()) || a.symbol.toLowerCase().includes(search.toLowerCase()),
  )

  const enabledCount = assets.filter((a) => a.enabled).length

  const grouped = filtered.reduce<Record<string, AdminAsset[]>>((acc, a) => {
    ;(acc[a.category] ||= []).push(a)
    return acc
  }, {})

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Ativos</h1>
          <p className="mt-1 text-sm text-gray-400">
            {enabledCount} de {assets.length} ativos visíveis na plataforma
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <input
              placeholder="Buscar ativo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 w-full rounded-lg border border-white/[0.06] bg-[#0c121c] pl-9 pr-3 text-sm text-white outline-none placeholder:text-gray-500 focus:border-white/20"
            />
          </div>
          <Button
            onClick={fetchAssets}
            variant="outline"
            size="icon"
            className="border-white/[0.06] bg-[#0c121c] hover:bg-[#141c2b]"
          >
            <RefreshCw className={`h-4 w-4 text-gray-300 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {loading && assets.length === 0 ? (
        <div className="flex items-center justify-center py-20 text-gray-500">
          <RefreshCw className="mr-2 h-5 w-5 animate-spin" /> Carregando ativos...
        </div>
      ) : (
        <div className="space-y-7">
          {Object.entries(grouped).map(([category, list]) => (
            <div key={category}>
              <div className="mb-3 flex items-center gap-2">
                <Layers className="h-4 w-4 text-gray-500" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
                  {CATEGORY_LABELS[category] || category}
                </h2>
                <span className="text-xs text-gray-600">({list.length})</span>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {list.map((asset) => (
                  <div
                    key={asset.symbol}
                    className={`group relative flex items-center gap-3 overflow-hidden rounded-2xl border p-4 transition-all ${
                      asset.enabled
                        ? "border-white/[0.08] bg-[#0c121c]"
                        : "border-white/[0.04] bg-[#0a0e16] opacity-70"
                    }`}
                  >
                    <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl ring-1 ring-white/10">
                      <Image
                        src={asset.logo || "/placeholder.svg"}
                        alt={asset.name}
                        fill
                        sizes="44px"
                        className="object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">{asset.name}</p>
                      <div className="mt-1 flex items-center gap-2">
                        {editingSymbol === asset.symbol ? (
                          <div className="flex items-center gap-1">
                            <div className="flex items-center rounded-md border border-emerald-500/40 bg-[#0a0e16] pl-2">
                              <input
                                type="number"
                                min={1}
                                max={100}
                                autoFocus
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" && !e.nativeEvent.isComposing) savePayout(asset.symbol)
                                  if (e.key === "Escape") cancelEditPayout()
                                }}
                                className="w-12 bg-transparent py-1 text-xs font-semibold text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                              />
                              <span className="pr-2 text-xs text-gray-500">%</span>
                            </div>
                            <button
                              onClick={() => savePayout(asset.symbol)}
                              className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500 text-white hover:bg-emerald-400"
                              aria-label="Salvar payout"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={cancelEditPayout}
                              className="px-1 text-xs text-gray-500 hover:text-gray-300"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => startEditPayout(asset.symbol, asset.payout)}
                            className="group/payout inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-500/10"
                            title="Editar payout"
                          >
                            <TrendingUp className="h-3 w-3" />
                            {savingPayout === asset.symbol ? (
                              <RefreshCw className="h-3 w-3 animate-spin" />
                            ) : (
                              <span>{asset.payout}%</span>
                            )}
                            {savedSymbol === asset.symbol ? (
                              <Check className="h-3 w-3 text-emerald-400" />
                            ) : (
                              <Pencil className="h-2.5 w-2.5 text-gray-500 opacity-0 transition-opacity group-hover/payout:opacity-100" />
                            )}
                          </button>
                        )}
                        <span className="text-xs text-gray-600">{asset.symbol}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Switch
                        checked={asset.enabled}
                        disabled={savingSymbol === asset.symbol}
                        onCheckedChange={(v) => toggleAsset(asset.symbol, v)}
                      />
                      <span className={`text-[10px] font-medium ${asset.enabled ? "text-emerald-400" : "text-gray-500"}`}>
                        {asset.enabled ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="py-16 text-center text-sm text-gray-500">Nenhum ativo encontrado.</p>
          )}
        </div>
      )}
    </div>
  )
}
