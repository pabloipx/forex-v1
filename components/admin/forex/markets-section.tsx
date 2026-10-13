"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Switch } from "@/components/ui/switch"
import { Badge, DataTable, ErrorNote, Panel, SmallButton, td } from "./ui"
import { adminAction, refreshAdmin, useAdminView } from "./use-admin"
import { cn } from "@/lib/utils"

interface MarketRow {
  symbol: string
  base: string
  category: string
  source: string
  price: number | null
  enabled: boolean
  maxLeverage: number
  takerFee: number
  makerFee: number
  spreadBps: number
}

type Draft = { maxLeverage: string; takerFee: string; makerFee: string; spreadBps: string }

const toDraft = (m: MarketRow): Draft => ({
  maxLeverage: String(m.maxLeverage),
  takerFee: (m.takerFee * 100).toFixed(4),
  makerFee: (m.makerFee * 100).toFixed(4),
  spreadBps: String(m.spreadBps),
})

const cellInput = "h-7 w-20 rounded border border-term-line bg-term-bg px-2 text-right font-mono text-xs text-term-text outline-none focus:border-primary"

export function MarketsSection() {
  const { data, error } = useAdminView<MarketRow[]>("markets", 5000)
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>("all")

  const save = async (symbol: string, patch: Record<string, unknown>) => {
    setBusy(symbol)
    try {
      await adminAction({ action: "update_market", symbol, ...patch })
      setDrafts(({ [symbol]: _removed, ...rest }) => rest)
      await refreshAdmin("markets")
      toast.success(`${symbol} atualizado`)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const rows = (data ?? []).filter((m) => filter === "all" || m.category === filter)

  return (
    <Panel
      title="Mercados e parâmetros de negociação"
      action={
        <div role="radiogroup" aria-label="Categoria" className="flex gap-1">
          {[
            ["all", "Todos"],
            ["forex", "Forex"],
            ["metals", "Metais"],
            ["crypto", "Cripto"],
          ].map(([k, l]) => (
            <button
              key={k}
              role="radio"
              aria-checked={filter === k}
              onClick={() => setFilter(k)}
              className={cn("rounded px-2 py-1 text-xs", filter === k ? "bg-term-line text-term-text" : "text-term-muted hover:text-term-text")}
            >
              {l}
            </button>
          ))}
        </div>
      }
    >
      <ErrorNote error={error} />
      <p className="border-b border-term-line px-4 py-2 text-[11px] leading-relaxed text-term-muted">
        As alterações valem para novas ordens imediatamente. Spread adicional em pontos-base (1 bp = 0,01%) é somado ao bid/ask da
        fonte. Mercado suspenso aceita apenas ordens de redução/fechamento.
      </p>
      <DataTable head={["Mercado", "Preço", "Ativo", "Alavancagem máx.", "Taxa taker %", "Taxa maker %", "Spread (bp)", ""]}>
        {rows.map((m) => {
          const d = drafts[m.symbol] ?? toDraft(m)
          const dirty = !!drafts[m.symbol]
          const set = (k: keyof Draft, v: string) => setDrafts((all) => ({ ...all, [m.symbol]: { ...d, [k]: v } }))
          return (
            <tr key={m.symbol} className="border-b border-term-line/60 last:border-0">
              <td className={cn(td, "font-sans")}>
                <span className="font-semibold">{m.symbol}</span> <Badge>{m.category}</Badge>
              </td>
              <td className={td}>{m.price ?? "—"}</td>
              <td className={td}>
                <Switch
                  checked={m.enabled}
                  disabled={busy === m.symbol}
                  onCheckedChange={(v) => save(m.symbol, { enabled: v })}
                  aria-label={`${m.enabled ? "Suspender" : "Ativar"} ${m.symbol}`}
                />
              </td>
              <td className={td}>
                <input aria-label="Alavancagem máxima" inputMode="numeric" className={cellInput} value={d.maxLeverage} onChange={(e) => set("maxLeverage", e.target.value)} />
              </td>
              <td className={td}>
                <input aria-label="Taxa taker" inputMode="decimal" className={cellInput} value={d.takerFee} onChange={(e) => set("takerFee", e.target.value)} />
              </td>
              <td className={td}>
                <input aria-label="Taxa maker" inputMode="decimal" className={cellInput} value={d.makerFee} onChange={(e) => set("makerFee", e.target.value)} />
              </td>
              <td className={td}>
                <input aria-label="Spread" inputMode="decimal" className={cellInput} value={d.spreadBps} onChange={(e) => set("spreadBps", e.target.value)} />
              </td>
              <td className={td}>
                <div className="flex gap-1.5">
                  <SmallButton
                    tone="accent"
                    disabled={!dirty || busy === m.symbol}
                    onClick={() =>
                      save(m.symbol, {
                        maxLeverage: Number.parseInt(d.maxLeverage, 10),
                        takerFee: Number(d.takerFee.replace(",", ".")) / 100,
                        makerFee: Number(d.makerFee.replace(",", ".")) / 100,
                        spreadBps: Number(d.spreadBps.replace(",", ".")),
                      })
                    }
                  >
                    Salvar
                  </SmallButton>
                  {dirty && (
                    <SmallButton onClick={() => setDrafts(({ [m.symbol]: _r, ...rest }) => rest)}>Desfazer</SmallButton>
                  )}
                </div>
              </td>
            </tr>
          )
        })}
      </DataTable>
    </Panel>
  )
}
