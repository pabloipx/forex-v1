"use client"

import { useState } from "react"
import { ChevronDown, TrendingUp, TrendingDown, Search, Lock } from "lucide-react"
import type { OTCAsset } from "@/lib/price-engine/types"
import { getMarketStatus } from "@/lib/market-hours"

interface AssetSelectorProps {
  assets: OTCAsset[]
  selectedAsset: OTCAsset | null
  onSelect: (symbol: string) => void
  currentPrice: number
  priceChange: number
}

const categoryIcons: Record<string, string> = {
  forex: "💱",
  crypto: "₿",
  commodities: "🏆",
  stocks: "📈",
}

const categoryNames: Record<string, string> = {
  forex: "Forex",
  crypto: "Cripto",
  commodities: "Commodities",
  stocks: "Ações",
}

export function AssetSelector({
  assets = [],
  selectedAsset,
  onSelect,
  currentPrice = 0,
  priceChange = 0,
}: AssetSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  const safeAssets = Array.isArray(assets) ? assets : []

  const filteredAssets = safeAssets.filter((asset) => {
    if (!asset) return false
    const matchesSearch =
      (asset.name?.toLowerCase() || "").includes(search.toLowerCase()) ||
      (asset.symbol?.toLowerCase() || "").includes(search.toLowerCase())
    const matchesCategory = !activeCategory || asset.category === activeCategory
    return matchesSearch && matchesCategory && asset.isActive
  })

  const categories = [...new Set(safeAssets.map((a) => a?.category).filter(Boolean))]

  const safeSelectedAsset = selectedAsset || {
    symbol: "EUR/USD",
    name: "EUR/USD (OTC)",
    category: "forex",
    payout: 96,
  }

  const formatPrice = (price: number) => {
    const safePrice = typeof price === "number" && !isNaN(price) ? price : 0
    if (safeSelectedAsset.symbol?.includes("BTC"))
      return safePrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 })
    if (safeSelectedAsset.symbol?.includes("JPY")) return safePrice.toFixed(3)
    if (safeSelectedAsset.symbol?.includes("ETH") || safeSelectedAsset.symbol?.includes("BNB"))
      return safePrice.toLocaleString("pt-BR", { minimumFractionDigits: 2 })
    if (safeSelectedAsset.category === "commodities") return safePrice.toFixed(2)
    return safePrice.toFixed(5)
  }

  const safePriceChange = typeof priceChange === "number" && !isNaN(priceChange) ? priceChange : 0
  const isUp = safePriceChange >= 0

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[#121826] border border-[#1f2933] hover:border-[#f97316]/50 transition-all"
      >
        <span className="text-xl">{categoryIcons[safeSelectedAsset.category] || "💱"}</span>
        <div className="flex flex-col items-start">
          <span className="text-white font-semibold text-sm">{safeSelectedAsset.name || "EUR/USD (OTC)"}</span>
          <div className="flex items-center gap-2">
            <span className="text-[#f97316] font-mono text-xs font-medium">{formatPrice(currentPrice)}</span>
            <span className={`text-xs flex items-center gap-0.5 ${isUp ? "text-[#fb923c]" : "text-[#EF4444]"}`}>
              {isUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {isUp ? "+" : ""}
              {safePriceChange.toFixed(2)}%
            </span>
          </div>
        </div>
        <ChevronDown className={`w-4 h-4 text-[#9CA3AF] transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-2 w-80 bg-[#121826] border border-[#1f2933] rounded-xl shadow-2xl z-50 overflow-hidden">
            {/* Search */}
            <div className="p-3 border-b border-[#1f2933]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
                <input
                  type="text"
                  placeholder="Buscar ativo..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-[#0B0F14] border border-[#1f2933] rounded-lg text-white text-sm placeholder:text-[#6B7280] focus:outline-none focus:border-[#f97316]"
                />
              </div>
            </div>

            {/* Categories */}
            <div className="flex gap-1 p-2 border-b border-[#1f2933] overflow-x-auto">
              <button
                onClick={() => setActiveCategory(null)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  !activeCategory ? "bg-[#f97316] text-white" : "bg-[#1f2933] text-[#9CA3AF] hover:text-white"
                }`}
              >
                Todos
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                    activeCategory === cat ? "bg-[#f97316] text-white" : "bg-[#1f2933] text-[#9CA3AF] hover:text-white"
                  }`}
                >
                  {categoryNames[cat] || cat}
                </button>
              ))}
            </div>

            {/* Asset List */}
            <div className="max-h-64 overflow-y-auto">
              {filteredAssets.length === 0 ? (
                <div className="p-4 text-center text-[#6B7280] text-sm">Nenhum ativo encontrado</div>
              ) : (
                filteredAssets.map((asset) => {
                  if (!asset) return null
                  const isSelected = safeSelectedAsset.symbol === asset.symbol
                  // Ativos de mercado aberto fora do horário ficam sinalizados. A seleção
                  // continua liberada para consultar o gráfico; quem bloqueia a entrada é o
                  // painel de operação.
                  const isClosed = !getMarketStatus(asset).open
                  return (
                    <button
                      key={asset.id || asset.symbol}
                      onClick={() => {
                        onSelect(asset.symbol)
                        setIsOpen(false)
                        setSearch("")
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-[#1f2933] transition-colors ${
                        isSelected ? "bg-[#f97316]/10 border-l-2 border-[#f97316]" : "border-l-2 border-transparent"
                      }`}
                    >
                      <span className={`text-xl ${isClosed ? "opacity-40" : ""}`}>
                        {categoryIcons[asset.category] || "💱"}
                      </span>
                      <div className="flex-1 text-left">
                        <div
                          className={`font-medium text-sm flex items-center gap-1.5 ${
                            isClosed ? "text-white/40" : "text-white"
                          }`}
                        >
                          {asset.name}
                          {isClosed && <Lock className="w-3 h-3 text-yellow-500 shrink-0" />}
                        </div>
                        <div className={`text-xs ${isClosed ? "text-yellow-500/70" : "text-[#6B7280]"}`}>
                          {isClosed ? "Mercado fechado" : asset.symbol}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`font-medium text-sm ${isClosed ? "text-white/30" : "text-[#f97316]"}`}>
                          {asset.payout || 96}%
                        </div>
                        <div className="text-[#6B7280] text-xs">payout</div>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
