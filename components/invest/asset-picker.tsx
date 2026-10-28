"use client"

import { useState } from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  getInvestAsset,
  INVEST_ASSET_GROUPS,
  INVEST_ASSETS,
  type InvestAsset,
  type InvestAssetGroup,
  type InvestAssetId,
} from "@/lib/invest-assets"

const GLYPH_TONE: Record<InvestAssetGroup, string> = {
  moedas: "border-iv-sky/40 bg-iv-sky/10 text-iv-sky",
  metais: "border-iv-gold/45 bg-iv-gold/10 text-iv-gold",
  tesouro: "border-iv-blue/45 bg-iv-blue/15 text-iv-ink",
}

export function AssetGlyph({ asset, className }: { asset: InvestAsset; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "iv-num flex size-11 flex-none items-center justify-center rounded-xl border font-semibold",
        asset.glyph.length > 2 ? "text-xs" : asset.glyph.length > 1 ? "text-sm" : "text-lg",
        GLYPH_TONE[asset.group],
        className,
      )}
    >
      {asset.glyph}
    </span>
  )
}

export function AssetPicker({ value, onChange }: { value: InvestAssetId; onChange: (id: InvestAssetId) => void }) {
  const [group, setGroup] = useState<InvestAssetGroup>(getInvestAsset(value).group)
  const assets = INVEST_ASSETS.filter((a) => a.group === group)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span id="asset-label" className="text-sm font-medium text-iv-ink/85">
          Escolha o ativo
        </span>
        <span className="text-xs text-iv-muted">{INVEST_ASSETS.length} ativos defensivos</span>
      </div>

      <div role="tablist" aria-label="Categorias de ativos" className="grid grid-cols-3 gap-1.5 rounded-2xl border border-iv-line/70 bg-iv-bg/50 p-1">
        {INVEST_ASSET_GROUPS.map((g) => {
          const active = g.id === group
          return (
            <button
              key={g.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setGroup(g.id)}
              className={cn(
                "h-11 rounded-xl text-sm font-medium transition-all active:scale-95",
                active ? "bg-iv-line text-iv-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]" : "text-iv-muted hover:text-iv-ink",
              )}
            >
              {g.label}
            </button>
          )
        })}
      </div>

      <ul role="radiogroup" aria-labelledby="asset-label" className="flex flex-col gap-2">
        {assets.map((a, i) => {
          const selected = a.id === value
          return (
            <li key={a.id} className="iv-rise" style={{ animationDelay: `${i * 60}ms` }}>
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onChange(a.id)}
                className={cn(
                  "flex min-h-16 w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-all active:scale-[0.99]",
                  selected
                    ? "border-iv-sky/60 bg-iv-blue/10 shadow-[0_0_0_4px_rgb(61_180_255/0.08)]"
                    : "border-iv-line/70 bg-iv-bg/40 hover:border-iv-line",
                )}
              >
                <AssetGlyph asset={a} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[15px] font-medium text-iv-ink">{a.name}</span>
                  <span className="truncate text-xs text-iv-muted">
                    <span className="iv-num font-semibold text-iv-ink/80">{a.ticker}</span> · {a.category}
                  </span>
                </span>
                <span
                  aria-hidden
                  className={cn(
                    "flex size-6 flex-none items-center justify-center rounded-full border transition-all",
                    selected ? "border-iv-sky bg-iv-sky text-iv-bg" : "border-iv-line",
                  )}
                >
                  {selected && <Check className="size-3.5" strokeWidth={3} />}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
