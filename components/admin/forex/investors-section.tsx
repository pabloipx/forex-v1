"use client"

import { getInvestAsset } from "@/lib/invest-assets"
import { useMemo, useState } from "react"
import { Coins, PiggyBank, Search } from "lucide-react"
import { Badge, ErrorNote, Panel, Stat, inputCls } from "./ui"
import { dateTime, signedUsd, usd, useAdminView } from "./use-admin"
import { UserDetailSheet } from "./user-detail-sheet"
import { cn } from "@/lib/utils"

interface Investor {
  user_id: string
  email: string
  full_name: string | null
}

interface CryptoRow extends Investor {
  launch_id: string
  symbol: string
  name: string
  icon_url: string | null
  phase: "presale" | "market"
  qty: number
  invested_usd: number
  price_usd: number
  value_usd: number
  pnl_usd: number
  updated_at: string
}

interface PassiveRow extends Investor {
  id: string
  amount: number
  monthlyYield: number
  months: number
  startedAt: string
  payoutsDone: number
  nextPayoutAt: string | null
  unlockAt: string
  yieldPaid: number
  available: number
  status: "active" | "completed"
  received_usd: number
}

type Tab = "crypto" | "passive"

const money = (v: number) => `US$ ${usd(v)}`
const shortDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("pt-BR") : "—")
const qtyFmt = (v: number) => v.toLocaleString("pt-BR", { maximumFractionDigits: 6 })

function matches(q: string, r: Investor) {
  if (!q) return true
  const s = q.toLowerCase()
  return r.email.toLowerCase().includes(s) || (r.full_name ?? "").toLowerCase().includes(s)
}

function InvestorName({ row, onOpen }: { row: Investor; onOpen: (r: Investor) => void }) {
  return (
    <button
      onClick={() => onOpen(row)}
      className="flex min-h-11 min-w-0 flex-col items-start justify-center text-left"
      aria-label={`Ver detalhes de ${row.full_name || row.email}`}
    >
      <span className="w-full truncate text-sm font-medium text-term-text">{row.full_name || "Sem nome"}</span>
      <span className="w-full truncate text-xs text-term-muted">{row.email}</span>
    </button>
  )
}

function Field({ label, value, tone }: { label: string; value: string; tone?: "up" | "down" | "accent" }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <span className="text-[11px] text-term-muted">{label}</span>
      <span
        className={cn(
          "truncate font-mono text-sm tabular-nums text-term-text",
          tone === "up" && "text-long",
          tone === "down" && "text-short",
          tone === "accent" && "text-primary",
        )}
      >
        {value}
      </span>
    </div>
  )
}

function CryptoList({ q, onOpen }: { q: string; onOpen: (r: Investor) => void }) {
  const { data, error, isLoading } = useAdminView<CryptoRow[]>("investors_crypto", 15000)
  const all = data ?? []
  const rows = all.filter((r) => matches(q, r))

  const totals = useMemo(() => {
    const invested = all.reduce((s, r) => s + r.invested_usd, 0)
    const value = all.reduce((s, r) => s + r.value_usd, 0)
    return { clients: new Set(all.map((r) => r.user_id)).size, invested, value, pnl: value - invested }
  }, [all])

  return (
    <>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <Stat label="Clientes" value={String(totals.clients)} />
        <Stat label="Total investido" value={money(totals.invested)} tone="accent" />
        <Stat label="Valor atual" value={money(totals.value)} />
        <Stat label="Resultado dos clientes" value={signedUsd(totals.pnl)} tone={totals.pnl >= 0 ? "up" : "down"} />
      </div>
      <Panel title={`Posições em criptos (${rows.length})`}>
        <ErrorNote error={error} />
        {!isLoading && rows.length === 0 && (
          <p className="px-4 py-10 text-center text-xs text-term-muted">
            {q ? "Nenhum investidor encontrado." : "Ninguém comprou moedas de lançamento ainda."}
          </p>
        )}
        <ul className="flex flex-col divide-y divide-term-line">
          {rows.map((r) => (
            <li key={`${r.user_id}-${r.launch_id}`} className="flex flex-col gap-3 px-4 py-3 animate-in fade-in-0 slide-in-from-bottom-1 duration-300">
              <div className="flex items-center justify-between gap-3">
                <InvestorName row={r} onOpen={onOpen} />
                <div className="flex shrink-0 items-center gap-2">
                  {r.icon_url ? (
                    <img src={r.icon_url || "/placeholder.svg"} alt="" className="size-6 rounded-full object-cover" />
                  ) : (
                    <Coins className="size-5 text-term-muted" aria-hidden="true" />
                  )}
                  <span className="font-mono text-sm font-semibold text-term-text">{r.symbol}</span>
                  <Badge tone={r.phase === "presale" ? "accent" : "up"}>{r.phase === "presale" ? "Pré-venda" : "Ao vivo"}</Badge>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 md:grid-cols-5">
                <Field label="Quantidade" value={qtyFmt(r.qty)} />
                <Field label="Investido" value={money(r.invested_usd)} />
                <Field label="Preço atual" value={money(r.price_usd)} />
                <Field label="Valor atual" value={money(r.value_usd)} tone="accent" />
                <Field label="Lucro / prejuízo" value={signedUsd(r.pnl_usd)} tone={r.pnl_usd >= 0 ? "up" : "down"} />
              </div>
              <span className="text-[11px] text-term-muted">Última compra/venda: {dateTime(r.updated_at)}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  )
}

function PassiveList({ q, onOpen }: { q: string; onOpen: (r: Investor) => void }) {
  const { data, error, isLoading } = useAdminView<PassiveRow[]>("investors_passive", 15000)
  const all = data ?? []
  const rows = all.filter((r) => matches(q, r))

  const totals = useMemo(() => {
    const active = all.filter((r) => r.status === "active")
    return {
      clients: new Set(active.map((r) => r.user_id)).size,
      applied: active.reduce((s, r) => s + r.amount, 0),
      monthly: active.reduce((s, r) => s + r.monthlyYield, 0),
      pending: all.reduce((s, r) => s + r.available, 0),
    }
  }, [all])

  return (
    <>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3">
        <Stat label="Clientes ativos" value={String(totals.clients)} />
        <Stat label="Valor aplicado" value={money(totals.applied)} tone="accent" />
        <Stat label="Rendimento por mês" value={money(totals.monthly)} hint="Pago todo dia 30" />
        <Stat label="Disponível p/ saque" value={money(totals.pending)} tone="up" hint="Ainda não sacado" />
      </div>
      <Panel title={`Investimentos de renda passiva (${rows.length})`}>
        <ErrorNote error={error} />
        {!isLoading && rows.length === 0 && (
          <p className="px-4 py-10 text-center text-xs text-term-muted">
            {q ? "Nenhum investidor encontrado." : "Ninguém investiu na renda passiva ainda."}
          </p>
        )}
        <ul className="flex flex-col divide-y divide-term-line">
          {rows.map((r) => {
            const progress = Math.min(100, (r.payoutsDone / r.months) * 100)
            return (
              <li key={r.id} className="flex flex-col gap-3 px-4 py-3 animate-in fade-in-0 slide-in-from-bottom-1 duration-300">
                <div className="flex items-center justify-between gap-3">
                  <InvestorName row={r} onOpen={onOpen} />
                  <Badge tone={r.status === "active" ? "up" : "muted"}>{r.status === "active" ? "Ativo" : "Concluído"}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 md:grid-cols-5">
                  <Field label="Ativo" value={`${getInvestAsset(r.asset).name} (${getInvestAsset(r.asset).ticker})`} />
                  <Field label="Investido" value={money(r.amount)} tone="accent" />
                  <Field label="Rendimento mensal" value={money(r.monthlyYield)} />
                  <Field label="Já sacado" value={money(r.received_usd)} />
                  <Field label="Disponível" value={money(r.available)} tone={r.available > 0 ? "up" : undefined} />
                  <Field label="Próximo rendimento" value={shortDate(r.nextPayoutAt)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-[11px] text-term-muted">
                    <span>
                      {r.payoutsDone} de {r.months} rendimentos
                    </span>
                    <span>Libera em {shortDate(r.unlockAt)}</span>
                  </div>
                  <div
                    className="h-1.5 overflow-hidden rounded-full bg-term-line"
                    role="progressbar"
                    aria-valuenow={r.payoutsDone}
                    aria-valuemin={0}
                    aria-valuemax={r.months}
                    aria-label="Rendimentos pagos"
                  >
                    <div className="h-full rounded-full bg-primary transition-[width] duration-700" style={{ width: `${progress}%` }} />
                  </div>
                </div>
                <span className="text-[11px] text-term-muted">Investiu em {dateTime(r.startedAt)}</span>
              </li>
            )
          })}
        </ul>
      </Panel>
    </>
  )
}

const TABS: { id: Tab; label: string; icon: typeof Coins }[] = [
  { id: "crypto", label: "Criptos", icon: Coins },
  { id: "passive", label: "Renda passiva", icon: PiggyBank },
]

export function InvestorsSection() {
  const [tab, setTab] = useState<Tab>("crypto")
  const [q, setQ] = useState("")
  const [viewing, setViewing] = useState<{ id: string; email: string } | null>(null)
  const open = (r: Investor) => setViewing({ id: r.user_id, email: r.email })

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div role="tablist" aria-label="Tipo de investimento" className="grid grid-cols-2 gap-1 rounded-lg border border-term-line bg-term-panel p-1 md:w-80">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={cn(
                "flex min-h-11 items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors md:min-h-9",
                tab === id ? "bg-primary/15 text-primary" : "text-term-muted hover:text-term-text",
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
        <label className="relative md:w-72">
          <span className="sr-only">Buscar investidor</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-term-muted" aria-hidden="true" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome ou e-mail"
            className={cn(inputCls, "h-11 pl-9 font-sans md:h-9")}
          />
        </label>
      </div>

      {tab === "crypto" ? <CryptoList q={q} onOpen={open} /> : <PassiveList q={q} onOpen={open} />}

      <UserDetailSheet user={viewing} onClose={() => setViewing(null)} />
    </div>
  )
}
