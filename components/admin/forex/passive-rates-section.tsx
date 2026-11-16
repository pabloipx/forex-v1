"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { ChevronDown, Info, Loader2, Percent, RotateCcw } from "lucide-react"
import { INVEST_ASSET_GROUPS, getInvestAsset, type InvestAssetId } from "@/lib/invest-assets"
import { fmtTerm, INVEST_TERM_OPTIONS } from "@/lib/invest-schedule"
import { cn } from "@/lib/utils"
import { ErrorNote, Panel } from "./ui"
import { adminAction, dateTime, usd, useAdminView } from "./use-admin"
import { mutate } from "swr"

interface RateRow {
  asset: InvestAssetId
  monthly_rate: number
  term_months: number
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
  const [draftTerm, setDraftTerm] = useState<Partial<Record<InvestAssetId, number>>>({})
  const [bulk, setBulk] = useState("")
  const [bulkTerm, setBulkTerm] = useState("")
  const [saving, setSaving] = useState(false)

  const rows = data ?? []
  const current = useMemo(() => new Map(rows.map((r) => [r.asset, toPct(r.monthly_rate)])), [rows])
  const currentTerm = useMemo(() => new Map(rows.map((r) => [r.asset, r.term_months])), [rows])

  const raw = (id: InvestAssetId) => draft[id] ?? (current.has(id) ? fmtPct(current.get(id)!) : "")
  const term = (id: InvestAssetId) => draftTerm[id] ?? currentTerm.get(id) ?? 3
  const changes = rows
    .map((r) => ({ id: r.asset, pct: parsePct(raw(r.asset)) }))
    .filter(({ id, pct }) => draft[id] !== undefined && !(Number.isFinite(pct) && Math.abs(pct - (current.get(id) ?? NaN)) < 1e-9))
  const termChanges = rows
    .map((r) => ({ id: r.asset, months: term(r.asset) }))
    .filter(({ id, months }) => draftTerm[id] !== undefined && months !== currentTerm.get(id))
  const changedAssets = new Set([...changes.map((c) => c.id), ...termChanges.map((c) => c.id)])
  const invalid = changes.some((c) => pctError(c.pct))
  const dirty = Object.keys(draft).length > 0 || Object.keys(draftTerm).length > 0
  const lastUpdate = rows.reduce<string | null>((acc, r) => (r.updated_at && (!acc || r.updated_at > acc) ? r.updated_at : acc), null)

  const bulkPct = parsePct(bulk)
  const bulkErr = bulk ? pctError(bulkPct) : null

  const applyBulk = () => {
    if ((!bulk && !bulkTerm) || bulkErr) return
    if (bulk) setDraft(Object.fromEntries(rows.map((r) => [r.asset, fmtPct(bulkPct)])))
    if (bulkTerm) setDraftTerm(Object.fromEntries(rows.map((r) => [r.asset, Number(bulkTerm)])))
  }

  const discard = () => {
    setDraft({})
    setDraftTerm({})
  }

  const save = async () => {
    if (!changedAssets.size || invalid || saving) return
    setSaving(true)
    try {
      const rates = changes.length ? Object.fromEntries(changes.map((c) => [c.id, c.pct])) : undefined
      const terms = termChanges.length ? Object.fromEntries(termChanges.map((c) => [c.id, c.months])) : undefined
      const res = await adminAction<{ rates: RateRow[] }>({ action: "set_invest_rates", rates, terms })
      await mutate("/api/admin/forex?view=invest_rates", res.rates, { revalidate: false })
      discard()
      setBulk("")
      setBulkTerm("")
      toast.success(changedAssets.size === 1 ? "Ativo atualizado" : `${changedAssets.size} ativos atualizados`)
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
          Taxa e prazo valem para <strong className="font-semibold">novos aportes</strong>. Quem já investiu mantém a taxa e o
          prazo contratados no dia do aporte, sem alteração nos rendimentos já agendados.
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
          <p className="text-xs text-term-muted">
            Preenche todos os ativos abaixo. Deixe em branco o que não quiser mudar. Revise e salve para valer.
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <FieldLabel htmlFor="bulk-rate" label="Taxa a.m.">
              <RateInput id="bulk-rate" value={bulk} onChange={setBulk} invalid={Boolean(bulkErr)} placeholder="Ex.: 8,5" />
            </FieldLabel>
            <FieldLabel htmlFor="bulk-term" label="Prazo">
              <TermSelect id="bulk-term" value={bulkTerm} onChange={setBulkTerm} placeholder="Manter" />
            </FieldLabel>
            <button
              type="submit"
              disabled={(!bulk && !bulkTerm) || Boolean(bulkErr) || !rows.length}
              className="col-span-2 h-11 shrink-0 self-end rounded-md bg-term-line px-4 text-sm font-medium text-term-text transition-colors hover:bg-term-line/70 disabled:opacity-50 sm:col-span-1"
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
                  const rateChanged = changes.some((c) => c.id === r.asset)
                  const termChanged = termChanges.some((c) => c.id === r.asset)
                  const months = term(r.asset)
                  const before = [
                    rateChanged && Number.isFinite(current.get(r.asset)) ? `${fmtPct(current.get(r.asset)!)}%` : null,
                    termChanged ? fmtTerm(currentTerm.get(r.asset)!) : null,
                  ].filter(Boolean)
                  const inputId = `rate-${r.asset}`
                  const termId = `term-${r.asset}`
                  return (
                    <li
                      key={r.asset}
                      className={cn(
                        "flex flex-col gap-3 px-4 py-3 transition-colors sm:flex-row sm:items-center",
                        (rateChanged || termChanged) && "bg-primary/5",
                      )}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-3">
                        <img
                          src={asset.logo}
                          alt=""
                          width={36}
                          height={36}
                          loading="lazy"
                          className="size-9 shrink-0 rounded-full object-cover ring-1 ring-term-line"
                        />
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-sm font-medium text-term-text">{asset.name}</span>
                          <span className="truncate font-mono text-xs text-term-muted">
                            {asset.ticker}
                            {before.length > 0 && <span className="font-sans"> · antes {before.join(" · ")}</span>}
                          </span>
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5 sm:w-72">
                        <div className="grid grid-cols-2 gap-2">
                          <FieldLabel htmlFor={inputId} label="Taxa a.m.">
                            <RateInput
                              id={inputId}
                              value={value}
                              onChange={(v) => setDraft((d) => ({ ...d, [r.asset]: v }))}
                              invalid={Boolean(err)}
                              describedBy={`${inputId}-hint`}
                            />
                          </FieldLabel>
                          <FieldLabel htmlFor={termId} label="Prazo">
                            <TermSelect
                              id={termId}
                              value={String(months)}
                              onChange={(v) => setDraftTerm((d) => ({ ...d, [r.asset]: Number(v) }))}
                              describedBy={`${inputId}-hint`}
                            />
                          </FieldLabel>
                        </div>
                        <p id={`${inputId}-hint`} className={cn("text-xs", err ? "text-short" : "text-term-muted")}>
                          {err ??
                            (Number.isFinite(pct)
                              ? `US$ ${usd(SAMPLE_AMOUNT, 0)} rende US$ ${usd((SAMPLE_AMOUNT * pct) / 100)}/mês · US$ ${usd(
                                  SAMPLE_AMOUNT * (1 + (pct / 100) * months),
                                )} em ${fmtTerm(months)}`
                              : "")}
                        </p>
                      </div>
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
            {changedAssets.size === 0
              ? "Nenhuma alteração"
              : invalid
                ? "Corrija os campos em vermelho"
                : `${changedAssets.size} ${changedAssets.size === 1 ? "ativo alterado" : "ativos alterados"}`}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={discard}
              disabled={!dirty || saving}
              aria-label="Descartar alterações"
              className="flex size-10 items-center justify-center gap-1.5 rounded-md text-sm text-term-muted transition-colors hover:text-term-text disabled:opacity-40 sm:w-auto sm:px-3"
            >
              <RotateCcw className="size-4" aria-hidden="true" />
              <span className="hidden sm:inline">Descartar</span>
            </button>
            <button
              type="button"
              onClick={save}
              disabled={!changedAssets.size || invalid || saving}
              className="flex h-10 items-center gap-2 whitespace-nowrap rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function FieldLabel({ htmlFor, label, children }: { htmlFor: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={htmlFor} className="text-[11px] font-medium uppercase tracking-wide text-term-muted">
        {label}
      </label>
      {children}
    </div>
  )
}

function TermSelect({
  id,
  value,
  onChange,
  placeholder,
  describedBy,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  describedBy?: string
}) {
  return (
    <div className="relative">
      <select
        id={id}
        value={value}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full appearance-none rounded-md border border-term-line bg-term-bg pl-3 pr-8 text-sm font-semibold text-term-text outline-none transition-colors focus:border-primary"
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {INVEST_TERM_OPTIONS.map((m) => (
          <option key={m} value={m}>
            {fmtTerm(m)}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-term-muted"
        aria-hidden="true"
      />
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
