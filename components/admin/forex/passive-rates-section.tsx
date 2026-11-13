"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Info, Loader2, Percent, RotateCcw } from "lucide-react"
import { INVEST_ASSET_GROUPS, getInvestAsset, type InvestAssetId } from "@/lib/invest-assets"
import { cn } from "@/lib/utils"
import { ErrorNote, Panel } from "./ui"
import { adminAction, dateTime, usd, useAdminView } from "./use-admin"
import { mutate } from "swr"

interface RateRow {
  asset: InvestAssetId
  monthly_rate: number
  updated_at: string | null
}

const SAMPLE_AMOUNT = 1000
const MIN_PCT = 0.01
const MAX_PCT = 100

const toPct = (rate: number) => Math.round(rate * 10000) / 100
const fmtPct = (pct: number) => pct.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 })
const parsePct = (raw: string) => {
  const s = raw.trim().replace(/\s|%/g, "").replace(",", ".")
  return s === "" || !/^\d*\.?\d*$/.test(s) ? NaN : Number(s)
}
const sanitize = (raw: string) => raw.replace(/[^\d.,]/g, "").replace(/([.,].*)[.,]/g, "$1")

function pctError(pct: number) {
  if (!Number.isFinite(pct)) return "Informe um número"
  if (pct < MIN_PCT) return "Mínimo 0,01%"
  if (pct > MAX_PCT) return "Máximo 100%"
  if (Math.abs(pct * 100 - Math.round(pct * 100)) > 1e-6) return "Use até 2 casas"
  return null
}

export function PassiveRatesSection() {
  const { data, error } = useAdminView<RateRow[]>("invest_rates")
  const [draft, setDraft] = useState<Partial<Record<InvestAssetId, string>>>({})
  const [bulk, setBulk] = useState("")
  const [saving, setSaving] = useState(false)

  const rows = data ?? []
  const current = useMemo(() => new Map(rows.map((r) => [r.asset, toPct(r.monthly_rate)])), [rows])

  const raw = (id: InvestAssetId) => draft[id] ?? (current.has(id) ? fmtPct(current.get(id)!) : "")
  const changes = rows
    .map((r) => ({ id: r.asset, pct: parsePct(raw(r.asset)) }))
    .filter(({ id, pct }) => draft[id] !== undefined && !(Number.isFinite(pct) && Math.abs(pct - (current.get(id) ?? NaN)) < 1e-9))
  const invalid = changes.some((c) => pctError(c.pct))
  const lastUpdate = rows.reduce<string | null>((acc, r) => (r.updated_at && (!acc || r.updated_at > acc) ? r.updated_at : acc), null)

  const bulkPct = parsePct(bulk)
  const bulkErr = bulk ? pctError(bulkPct) : null

  const applyBulk = () => {
    if (!bulk || bulkErr) return
    setDraft(Object.fromEntries(rows.map((r) => [r.asset, fmtPct(bulkPct)])))
  }

  const save = async () => {
    if (!changes.length || invalid || saving) return
    setSaving(true)
    try {
      const rates = Object.fromEntries(changes.map((c) => [c.id, c.pct]))
      const res = await adminAction<{ rates: RateRow[] }>({ action: "set_invest_rates", rates })
      await mutate("/api/admin/forex?view=invest_rates", res.rates, { revalidate: false })
      setDraft({})
      setBulk("")
      toast.success(changes.length === 1 ? "Taxa atualizada" : `${changes.length} taxas atualizadas`)
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <ErrorNote error={error} />

      <div className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary/10 px-4 py-3 text-xs leading-relaxed text-term-text">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <p>
          A taxa vale para <strong className="font-semibold">novos aportes</strong>. Quem já investiu continua recebendo a taxa
          contratada no dia do aporte, sem alteração nos rendimentos já agendados.
        </p>
      </div>

      <Panel
        title="Aplicar a todos os ativos"
        action={
          <span className="flex size-7 items-center justify-center rounded-md bg-primary/15 text-primary">
            <Percent className="size-4" aria-hidden="true" />
          </span>
        }
      >
        <form
          className="flex flex-col gap-2 p-4"
          onSubmit={(e) => {
            e.preventDefault()
            applyBulk()
          }}
        >
          <label htmlFor="bulk-rate" className="text-xs text-term-muted">
            Preenche todos os campos abaixo. Revise e salve para valer.
          </label>
          <div className="flex gap-2">
            <RateInput id="bulk-rate" value={bulk} onChange={setBulk} invalid={Boolean(bulkErr)} placeholder="Ex.: 8,5" />
            <button
              type="submit"
              disabled={!bulk || Boolean(bulkErr) || !rows.length}
              className="h-11 shrink-0 rounded-md bg-term-line px-4 text-sm font-medium text-term-text transition-colors hover:bg-term-line/70 disabled:opacity-50"
            >
              Preencher
            </button>
          </div>
          {bulkErr && <p className="text-xs text-short">{bulkErr}</p>}
        </form>
      </Panel>

      {INVEST_ASSET_GROUPS.map((group) => {
        const groupRows = rows.filter((r) => getInvestAsset(r.asset).group === group.id)
        return (
          <Panel key={group.id} title={group.label}>
            {!data && !error ? (
              <div className="flex flex-col gap-3 p-4" aria-hidden="true">
                {[0, 1].map((i) => (
                  <div key={i} className="h-14 animate-pulse rounded-lg bg-term-line/40" />
                ))}
              </div>
            ) : (
              <ul className="divide-y divide-term-line/60">
                {groupRows.map((r) => {
                  const asset = getInvestAsset(r.asset)
                  const value = raw(r.asset)
                  const pct = parsePct(value)
                  const err = draft[r.asset] !== undefined ? pctError(pct) : null
                  const changed = changes.some((c) => c.id === r.asset)
                  const inputId = `rate-${r.asset}`
                  return (
                    <li key={r.asset} className={cn("flex flex-col gap-2 px-4 py-3 transition-colors", changed && "bg-primary/5")}>
                      <div className="flex items-center gap-3">
                        <img
                          src={asset.logo}
                          alt=""
                          width={36}
                          height={36}
                          loading="lazy"
                          className="size-9 shrink-0 rounded-full object-cover ring-1 ring-term-line"
                        />
                        <label htmlFor={inputId} className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-sm font-medium text-term-text">{asset.name}</span>
                          <span className="truncate font-mono text-xs text-term-muted">
                            {asset.ticker}
                            {changed && Number.isFinite(current.get(r.asset)) && (
                              <span className="font-sans"> · antes {fmtPct(current.get(r.asset)!)}%</span>
                            )}
                          </span>
                        </label>
                        <div className="w-28 shrink-0">
                          <RateInput
                            id={inputId}
                            value={value}
                            onChange={(v) => setDraft((d) => ({ ...d, [r.asset]: v }))}
                            invalid={Boolean(err)}
                            describedBy={`${inputId}-hint`}
                          />
                        </div>
                      </div>
                      <p id={`${inputId}-hint`} className={cn("text-right text-xs", err ? "text-short" : "text-term-muted")}>
                        {err ??
                          (Number.isFinite(pct)
                            ? `US$ ${usd(SAMPLE_AMOUNT, 0)} rende US$ ${usd((SAMPLE_AMOUNT * pct) / 100)} por mês`
                            : "")}
                      </p>
                    </li>
                  )
                })}
              </ul>
            )}
          </Panel>
        )
      })}

      {lastUpdate && <p className="px-1 text-xs text-term-muted">Última alteração: {dateTime(lastUpdate)}</p>}

      <div className="sticky bottom-3 z-20 rounded-xl border border-term-line bg-term-panel/95 px-4 py-3 shadow-[0_-8px_30px_-12px_rgb(0_0_0/0.6)] backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0 text-xs leading-snug text-term-muted" aria-live="polite">
            {changes.length === 0
              ? "Nenhuma alteração"
              : invalid
                ? "Corrija os campos em vermelho"
                : `${changes.length} ${changes.length === 1 ? "alteração" : "alterações"}`}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDraft({})}
              disabled={!Object.keys(draft).length || saving}
              aria-label="Descartar alterações"
              className="flex size-10 items-center justify-center gap-1.5 rounded-md text-sm text-term-muted transition-colors hover:text-term-text disabled:opacity-40 sm:w-auto sm:px-3"
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">Descartar</span>
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!changes.length || invalid || saving}
              className="flex h-10 items-center gap-2 whitespace-nowrap rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              Salvar taxas
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function RateInput({
  id,
  value,
  onChange,
  invalid,
  placeholder,
  describedBy,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  invalid?: boolean
  placeholder?: string
  describedBy?: string
}) {
  return (
    <div
      className={cn(
        "flex h-11 w-full items-center gap-1 rounded-md border bg-term-bg px-3 transition-colors focus-within:border-primary",
        invalid ? "border-short" : "border-term-line",
      )}
    >
      <input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={(e) => onChange(sanitize(e.target.value))}
        className="w-full min-w-0 bg-transparent text-right font-mono text-base font-semibold tabular-nums text-term-text outline-none placeholder:font-sans placeholder:text-sm placeholder:font-normal placeholder:text-term-muted/60"
      />
      <span className="text-sm text-term-muted">%</span>
    </div>
  )
}
