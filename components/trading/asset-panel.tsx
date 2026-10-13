"use client"

import { memo, useEffect, useMemo, useRef, useState } from "react"
import Image from "next/image"
import { Search, X, Lock, Clock, Check } from "lucide-react"
import { getMarketStatus } from "@/lib/market-hours"

/**
 * Painel lateral de ativos (desktop).
 *
 * Substitui o modal centralizado no desktop por uma gaveta ancorada a esquerda, no estilo das
 * mesas profissionais (IQ Option): o grafico continua visivel enquanto o operador navega pela
 * lista, o que evita o "pisca-esconde" do modal a cada troca de ativo.
 *
 * O modal centralizado segue existindo para o mobile, onde uma gaveta lateral estreita nao faz
 * sentido — por isso este componente e renderizado apenas a partir do breakpoint `lg`.
 *
 * Estado de busca/aba fica dentro do painel de proposito: cada abertura comeca limpa, sem herdar
 * o filtro digitado no mobile.
 */

interface PanelAsset {
  symbol: string
  name: string
  category: string
  payout: number
  logo: string
  market?: "otc" | "open"
}

interface AssetPanelProps {
  open: boolean
  assets: PanelAsset[]
  selectedSymbol: string
  openTabs: string[]
  onSelect: (symbol: string) => void
  onClose: () => void
  /** Timestamp que muda periodicamente na pagina, para reavaliar horario de mercado. */
  clockTick: number
}

const CATEGORY_LABELS: Record<string, string> = {
  forex: "Moedas",
  crypto: "Criptomoedas",
  commodities: "Commodities",
  stocks: "Ações",
  indices: "Índices",
}

// Ordem de exibicao dos grupos. Categorias fora desta lista vao para o fim, em ordem alfabetica.
const CATEGORY_ORDER = ["forex", "crypto", "commodities", "stocks", "indices"]

const MARKET_TABS = [
  { id: "otc", label: "OTC" },
  { id: "open", label: "Mercado aberto" },
] as const

function AssetPanelBase({
  open,
  assets,
  selectedSymbol,
  openTabs,
  onSelect,
  onClose,
  clockTick,
}: AssetPanelProps) {
  const [search, setSearch] = useState("")
  const [marketTab, setMarketTab] = useState<"otc" | "open">("otc")
  const searchRef = useRef<HTMLInputElement>(null)

  // Cada abertura comeca do zero e com o cursor na busca, que e o caminho mais rapido para quem
  // ja sabe o ativo que quer.
  useEffect(() => {
    if (!open) return
    setSearch("")
    const id = setTimeout(() => searchRef.current?.focus(), 120)
    return () => clearTimeout(id)
  }, [open])

  // Esc fecha, como em qualquer dialogo.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onClose])

  // A busca ignora a aba de mercado: procurar "ouro" tendo que adivinhar em qual aba ele esta
  // seria trabalho manual desnecessario.
  const results = useMemo(() => {
    const term = search.trim().toLowerCase()
    const base = term
      ? assets.filter(
          (a) => a.name.toLowerCase().includes(term) || a.symbol.toLowerCase().includes(term),
        )
      : assets.filter((a) => (a.market || "otc") === marketTab)

    const groups = new Map<string, PanelAsset[]>()
    for (const asset of base) {
      const key = asset.category || "outros"
      const list = groups.get(key)
      if (list) list.push(asset)
      else groups.set(key, [asset])
    }

    return [...groups.entries()]
      .sort(([a], [b]) => {
        const ia = CATEGORY_ORDER.indexOf(a)
        const ib = CATEGORY_ORDER.indexOf(b)
        if (ia !== -1 && ib !== -1) return ia - ib
        if (ia !== -1) return -1
        if (ib !== -1) return 1
        return a.localeCompare(b)
      })
      .map(([category, list]) => ({
        category,
        // Mercado fechado desce na lista: o que da para operar agora aparece primeiro.
        assets: [...list].sort((a, b) => {
          const ca = getMarketStatus(a, new Date(clockTick)).open ? 0 : 1
          const cb = getMarketStatus(b, new Date(clockTick)).open ? 0 : 1
          if (ca !== cb) return ca - cb
          return a.name.localeCompare(b.name)
        }),
      }))
  }, [assets, search, marketTab, clockTick])

  const total = useMemo(() => results.reduce((sum, g) => sum + g.assets.length, 0), [results])

  if (!open) return null

  return (
    // `hidden lg:block`: no mobile quem responde e o modal centralizado da pagina.
    <div className="hidden lg:block">
      <button
        type="button"
        aria-label="Fechar lista de ativos"
        onClick={onClose}
        className="fixed inset-0 z-40 cursor-default bg-black/50 animate-in fade-in duration-200"
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Selecionar ativo"
        className="fixed left-0 top-0 z-50 flex h-[100dvh] w-[384px] flex-col border-r border-white/[0.08] shadow-2xl animate-in slide-in-from-left-6 fade-in duration-200 ease-out"
        style={{ backgroundColor: "#111114" }}
      >
        {/* Cabecalho */}
        <div className="flex items-center justify-between gap-3 px-5 pb-4 pt-5">
          <div className="min-w-0">
            <h2 className="text-base font-bold leading-tight text-white">Ativos</h2>
            <p className="mt-0.5 text-xs text-gray-500">
              {total} {total === 1 ? "disponível" : "disponíveis"}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Busca */}
        <div className="px-5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar ativo"
              className="w-full rounded-lg border border-white/[0.06] py-2.5 pl-9 pr-9 text-sm text-white outline-none transition-colors placeholder:text-gray-500 focus:border-[#ff8a00]/60"
              style={{ backgroundColor: "#1a1a1e" }}
            />
            {search && (
              <button
                onClick={() => {
                  setSearch("")
                  searchRef.current?.focus()
                }}
                aria-label="Limpar busca"
                className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-white/[0.06] hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Abas de mercado. Escondidas durante a busca, que varre os dois mercados. */}
        {!search && (
          <div className="flex gap-1 px-5 pt-3">
            {MARKET_TABS.map((tab) => {
              const active = marketTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setMarketTab(tab.id)}
                  className={`relative flex-1 pb-2.5 pt-1 text-[13px] font-semibold transition-colors ${
                    active ? "text-white" : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  {tab.label}
                  <span
                    className={`absolute bottom-0 left-0 right-0 h-0.5 rounded-full transition-colors ${
                      active ? "bg-[#ff8a00]" : "bg-transparent"
                    }`}
                  />
                </button>
              )
            })}
          </div>
        )}

        <div className="mt-1 h-px bg-white/[0.06]" />

        {/* Lista */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4">
          {total === 0 && (
            <p className="px-5 py-10 text-center text-sm text-gray-500">
              {search ? `Nenhum ativo para "${search}".` : "Nenhum ativo nesta aba."}
            </p>
          )}

          {results.map((group) => (
            <section key={group.category}>
              <h3
                className="sticky top-0 z-10 px-5 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-500 backdrop-blur-sm"
                style={{ backgroundColor: "rgba(17,17,20,0.92)" }}
              >
                {CATEGORY_LABELS[group.category] || group.category}
              </h3>

              {group.assets.map((asset) => {
                const status = getMarketStatus(asset, new Date(clockTick))
                const closed = !status.open
                const isSelected = asset.symbol === selectedSymbol
                const isOpenTab = openTabs.includes(asset.symbol)
                const openLabel = status.nextOpen
                  ? status.nextOpen.toLocaleString("pt-BR", {
                      timeZone: "America/Sao_Paulo",
                      weekday: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : null

                return (
                  <button
                    key={asset.symbol}
                    disabled={closed}
                    aria-disabled={closed}
                    aria-current={isSelected ? "true" : undefined}
                    onClick={() => {
                      if (closed) return
                      onSelect(asset.symbol)
                      onClose()
                    }}
                    className={`group relative flex w-full items-center gap-3 py-2.5 pl-5 pr-4 text-left transition-colors ${
                      closed
                        ? "cursor-not-allowed opacity-45"
                        : isSelected
                          ? "bg-white/[0.05]"
                          : "hover:bg-white/[0.035]"
                    }`}
                  >
                    {/* Trilha laranja: marca o ativo em tela e acompanha o hover. */}
                    <span
                      className={`absolute bottom-1 left-0 top-1 w-[3px] rounded-r-full transition-colors ${
                        isSelected
                          ? "bg-[#ff8a00]"
                          : closed
                            ? "bg-transparent"
                            : "bg-transparent group-hover:bg-white/20"
                      }`}
                    />

                    <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full bg-gray-700 ring-1 ring-white/10">
                      {/* `eager`: a lista e curta e as logos pesam poucos KB, entao esperar o
                          lazy-loading disparar por scroll so faria os icones aparecerem em
                          cascata depois da gaveta abrir. */}
                      <Image
                        src={asset.logo || "/placeholder.svg"}
                        alt=""
                        width={32}
                        height={32}
                        loading="eager"
                        className={`h-full w-full object-cover ${closed ? "grayscale" : ""}`}
                      />
                      {closed && (
                        <span className="absolute inset-0 flex items-center justify-center bg-black/55">
                          <Lock className="h-3 w-3 text-yellow-400" />
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate text-[13px] font-semibold text-white">
                        {asset.name}
                        {isOpenTab && !closed && (
                          <span
                            title="Já aberto em uma aba"
                            className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#ff8a00]"
                          />
                        )}
                      </p>
                      {closed ? (
                        <p className="mt-0.5 flex items-center gap-1 text-[11px] text-yellow-500">
                          <Clock className="h-3 w-3 shrink-0" />
                          {openLabel ? `Abre ${openLabel}` : "Mercado fechado"}
                        </p>
                      ) : (
                        <p className="mt-0.5 text-[11px] text-gray-500">
                          {(asset.market || "otc") === "otc" ? "Opção binária" : "Mercado aberto"}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      {closed ? (
                        <span className="rounded-md bg-yellow-500/15 px-2 py-1 text-[11px] font-semibold text-yellow-500">
                          Fechado
                        </span>
                      ) : (
                        <span className="font-mono text-[13px] font-bold text-[#ff8a00]">
                          {asset.payout}%
                        </span>
                      )}
                      {isSelected && !closed && <Check className="h-3.5 w-3.5 text-[#ff8a00]" />}
                    </div>
                  </button>
                )
              })}
            </section>
          ))}
        </div>
      </aside>
    </div>
  )
}

// Memoizado para não re-renderizar a lista de ativos a cada tick de preço da tela de trade.
// As props são estáveis (o callback onClose é estabilizado com useCallback no componente pai).
export const AssetPanel = memo(AssetPanelBase)
