"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, X, Check, Ban, TrendingUp, Users, Wallet, Percent } from "lucide-react"
import {
  ADMIN_TOKEN,
  MODEL_LABEL,
  compact,
  dateOnly,
  dateTime,
  money,
  patchAffiliate,
  pct,
  type AdminAffiliate,
  type AffiliateDetail,
  type CommissionModel,
} from "./types"

type Tab = "resumo" | "termos" | "referidos" | "comissoes" | "saques" | "historico"

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "resumo", label: "Resumo" },
  { id: "termos", label: "CPA & RevShare" },
  { id: "referidos", label: "Referidos" },
  { id: "comissoes", label: "Comissões" },
  { id: "saques", label: "Saques" },
  { id: "historico", label: "Histórico" },
]

const card = "rounded-lg bg-[#0a0e17] border border-[#1F2933] p-4"
const label = "text-white/40 text-[11px] uppercase tracking-wide"
const input =
  "w-full h-10 rounded-lg bg-[#0a0e17] border border-[#1F2933] px-3 text-sm text-white outline-none focus:border-[#f97316]"

export function AffiliateDrawer({
  affiliate,
  onClose,
  onSaved,
}: {
  affiliate: AdminAffiliate
  onClose: () => void
  onSaved: () => void
}) {
  const [tab, setTab] = useState<Tab>("resumo")
  const [detail, setDetail] = useState<AffiliateDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)

  const [model, setModel] = useState<CommissionModel>(affiliate.terms.model)
  const [revshare, setRevshare] = useState(String(affiliate.terms.revshare_percent))
  const [cpa, setCpa] = useState(String(affiliate.terms.cpa_amount))
  const [cpaMin, setCpaMin] = useState(String(affiliate.terms.cpa_min_deposit))
  const [subPercent, setSubPercent] = useState(String(affiliate.terms.sub_percent))
  const [notes, setNotes] = useState(affiliate.notes || "")
  const [reason, setReason] = useState("")
  const [delta, setDelta] = useState("")
  const [deltaReason, setDeltaReason] = useState("")

  const loadDetail = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/affiliates?affiliateId=${encodeURIComponent(affiliate.id)}`, {
        headers: { "x-admin-token": ADMIN_TOKEN },
      })
      const json = await res.json()
      setDetail(json.detail ?? null)
    } catch {
      setError("Não foi possível carregar os detalhes")
    } finally {
      setLoading(false)
    }
  }, [affiliate.id])

  useEffect(() => {
    loadDetail()
  }, [loadDetail])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [onClose])

  const run = async (body: Record<string, unknown>, successMessage: string) => {
    setSaving(true)
    setError(null)
    setOk(null)
    try {
      await patchAffiliate(body)
      setOk(successMessage)
      onSaved()
      await loadDetail()
      setTimeout(() => setOk(null), 2500)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao salvar")
    } finally {
      setSaving(false)
    }
  }

  const saveTerms = () =>
    run(
      {
        affiliateId: affiliate.id,
        action: "update_terms",
        data: {
          model,
          revshare_percent: Number(revshare),
          cpa_amount: Number(cpa),
          cpa_min_deposit: Number(cpaMin),
          sub_percent: Number(subPercent),
          notes,
          reason,
        },
      },
      "Termos atualizados",
    )

  const changeStatus = (status: string) =>
    run({ affiliateId: affiliate.id, action: "update_status", data: { status } }, `Status alterado para ${status}`)

  const adjustBalance = () =>
    run(
      { affiliateId: affiliate.id, action: "adjust_balance", data: { delta: Number(delta), reason: deltaReason } },
      "Saldo ajustado",
    )

  const data = detail ?? affiliate

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" aria-label="Fechar" onClick={onClose} className="absolute inset-0 bg-black/70" />

      <aside className="relative flex h-full w-full max-w-[720px] flex-col bg-[#121826] shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-[#1F2933] p-5">
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold text-white">{data.name}</p>
            <p className="truncate text-sm text-white/40">
              {data.email} · código <span className="text-[#f97316]">{data.code}</span>
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${
                  data.status === "active"
                    ? "bg-[#22c55e]/15 text-[#22c55e]"
                    : data.status === "blocked"
                      ? "bg-red-500/15 text-red-400"
                      : "bg-yellow-500/15 text-yellow-400"
                }`}
              >
                {data.status === "active" ? "Ativo" : data.status === "blocked" ? "Bloqueado" : "Pendente"}
              </span>
              <span className="rounded-md bg-[#f97316]/15 px-2 py-0.5 text-[11px] font-medium text-[#f97316]">
                {MODEL_LABEL[data.terms.model]}
              </span>
              <span className="text-[11px] text-white/40">Desde {dateOnly(data.created_at)}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar painel"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#1F2933] text-white/60 hover:bg-[#0a0e17] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <nav className="flex gap-1 overflow-x-auto border-b border-[#1F2933] px-3">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`shrink-0 border-b-2 px-3 py-3 text-sm transition-colors ${
                tab === t.id
                  ? "border-[#f97316] text-white"
                  : "border-transparent text-white/40 hover:text-white/70"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {(error || ok) && (
          <p
            role="status"
            aria-live="polite"
            className={`border-b px-5 py-3 text-sm ${
              error
                ? "border-red-500/20 bg-red-500/10 text-red-400"
                : "border-[#22c55e]/20 bg-[#22c55e]/10 text-[#22c55e]"
            }`}
          >
            {error || ok}
          </p>
        )}

        <div className="flex-1 overflow-y-auto p-5">
          {loading && tab !== "termos" ? (
            <p className="flex items-center gap-2 text-sm text-white/50">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando dados
            </p>
          ) : (
            <>
              {tab === "resumo" && (
                <div className="flex flex-col gap-5">
                  <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    <Metric icon={Wallet} label="Saldo" value={money(data.balance)} />
                    <Metric icon={TrendingUp} label="Total ganho" value={money(data.total_earned)} />
                    <Metric icon={Users} label="Referidos" value={compact(data.referrals)} />
                    <Metric icon={Percent} label="Conversão" value={pct(data.conversion_rate)} />
                  </div>

                  <div className={card}>
                    <p className="mb-3 text-sm font-medium text-white">Composição das comissões</p>
                    <dl className="grid grid-cols-2 gap-4">
                      <Item label="RevShare acumulado" value={money(data.revshare_earned)} />
                      <Item label="CPA acumulado" value={money(data.cpa_earned)} />
                      <Item label="Já pago" value={money(data.paid_out)} />
                      <Item label="Saque pendente" value={money(data.pending_payout)} />
                    </dl>
                  </div>

                  <div className={card}>
                    <p className="mb-3 text-sm font-medium text-white">Desempenho dos referidos</p>
                    <dl className="grid grid-cols-2 gap-4">
                      <Item label="Depositantes" value={`${compact(data.depositors)} / ${compact(data.referrals)}`} />
                      <Item label="Depósitos" value={`${compact(data.deposit_count)} · ${money(data.deposit_total)}`} />
                      <Item label="Ticket médio" value={money(data.avg_deposit)} />
                      <Item label="Volume operado" value={money(data.trade_volume)} />
                      <Item label="Receita da casa" value={money(data.net_revenue)} />
                      <Item label="Margem após comissão" value={pct(data.margin)} />
                    </dl>
                  </div>

                  <div className={card}>
                    <p className="mb-3 text-sm font-medium text-white">Ajustar saldo manualmente</p>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <input
                        className={input}
                        placeholder="Valor (+ crédito / - débito)"
                        value={delta}
                        onChange={(e) => setDelta(e.target.value)}
                        inputMode="decimal"
                      />
                      <input
                        className={input}
                        placeholder="Motivo do ajuste"
                        value={deltaReason}
                        onChange={(e) => setDeltaReason(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={adjustBalance}
                        disabled={saving || !delta}
                        className="h-10 shrink-0 rounded-lg bg-[#f97316] px-5 text-sm font-medium text-white disabled:opacity-40"
                      >
                        Aplicar
                      </button>
                    </div>
                    <p className="mt-2 text-[11px] text-white/30">
                      Créditos somam ao total ganho. Todo ajuste fica registrado no histórico.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {data.status !== "active" && (
                      <button
                        type="button"
                        onClick={() => changeStatus("active")}
                        disabled={saving}
                        className="flex h-10 items-center gap-2 rounded-lg bg-[#22c55e] px-4 text-sm font-medium text-white disabled:opacity-40"
                      >
                        <Check className="h-4 w-4" /> Ativar afiliado
                      </button>
                    )}
                    {data.status !== "blocked" && (
                      <button
                        type="button"
                        onClick={() => changeStatus("blocked")}
                        disabled={saving}
                        className="flex h-10 items-center gap-2 rounded-lg bg-red-500 px-4 text-sm font-medium text-white disabled:opacity-40"
                      >
                        <Ban className="h-4 w-4" /> Bloquear
                      </button>
                    )}
                  </div>
                </div>
              )}

              {tab === "termos" && (
                <div className="flex flex-col gap-5">
                  <div className={card}>
                    <p className="mb-3 text-sm font-medium text-white">Modelo de comissão</p>
                    <div className="grid grid-cols-3 gap-2">
                      {(["revshare", "cpa", "hybrid"] as CommissionModel[]).map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setModel(m)}
                          className={`h-10 rounded-lg border text-sm transition-colors ${
                            model === m
                              ? "border-[#f97316] bg-[#f97316]/15 text-[#f97316]"
                              : "border-[#1F2933] text-white/50 hover:text-white"
                          }`}
                        >
                          {MODEL_LABEL[m]}
                        </button>
                      ))}
                    </div>
                    <p className="mt-3 text-[11px] leading-relaxed text-white/40">
                      {model === "revshare" && "Percentual sobre todos os depósitos dos referidos."}
                      {model === "cpa" && "Valor fixo pago uma única vez por referido que atingir o depósito mínimo."}
                      {model === "hybrid" && "CPA no primeiro depósito qualificado somado ao RevShare de todos os depósitos."}
                    </p>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="RevShare (%)" hint="Percentual sobre cada depósito">
                      <input className={input} value={revshare} onChange={(e) => setRevshare(e.target.value)} inputMode="decimal" />
                    </Field>
                    <Field label="Valor do CPA (R$)" hint="Pago uma vez por referido qualificado">
                      <input className={input} value={cpa} onChange={(e) => setCpa(e.target.value)} inputMode="decimal" />
                    </Field>
                    <Field label="Depósito mínimo do CPA (R$)" hint="Valor que qualifica o referido">
                      <input className={input} value={cpaMin} onChange={(e) => setCpaMin(e.target.value)} inputMode="decimal" />
                    </Field>
                    <Field label="Sub-afiliado (%)" hint="Percentual sobre a rede indireta">
                      <input className={input} value={subPercent} onChange={(e) => setSubPercent(e.target.value)} inputMode="decimal" />
                    </Field>
                  </div>

                  <Field label="Observações internas" hint="Visível apenas para o admin">
                    <textarea
                      className={`${input} h-24 resize-none py-2`}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </Field>

                  <Field label="Motivo da alteração" hint="Registrado no histórico de auditoria">
                    <input className={input} value={reason} onChange={(e) => setReason(e.target.value)} />
                  </Field>

                  <button
                    type="button"
                    onClick={saveTerms}
                    disabled={saving}
                    className="flex h-11 items-center justify-center gap-2 rounded-lg bg-[#f97316] text-sm font-medium text-white disabled:opacity-40"
                  >
                    {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                    Salvar termos
                  </button>
                </div>
              )}

              {tab === "referidos" && (
                <Table
                  head={["Usuário", "Cadastro", "Depósitos", "Volume", "Receita"]}
                  rows={(detail?.referral_list ?? []).map((r) => [
                    <div key="u" className="min-w-0">
                      <p className="truncate text-white">{r.name}</p>
                      <p className="truncate text-[11px] text-white/40">{r.email}</p>
                    </div>,
                    dateOnly(r.created_at),
                    `${r.deposit_count}× · ${money(r.deposit_total)}`,
                    money(r.trade_volume),
                    money(r.net_revenue),
                  ])}
                  empty="Nenhum referido ainda"
                />
              )}

              {tab === "comissoes" && (
                <Table
                  head={["Data", "Referido", "Depósito", "Modelo", "Comissão"]}
                  rows={(detail?.commissions ?? []).map((c) => [
                    dateTime(c.created_at),
                    c.referred_name,
                    money(c.deposit_amount),
                    c.cpa_amount > 0 ? `CPA ${money(c.cpa_amount)}` : `Rev ${c.commission_percent}%`,
                    <span key="v" className="text-[#22c55e]">
                      {money(c.commission_amount)}
                    </span>,
                  ])}
                  empty="Nenhuma comissão gerada"
                />
              )}

              {tab === "saques" && (
                <Table
                  head={["Data", "Solicitado", "Taxa", "Líquido", "Status"]}
                  rows={(detail?.withdrawals ?? []).map((w) => [
                    dateTime(w.created_at),
                    money(w.amount),
                    money(w.fee),
                    money(w.net_amount),
                    <StatusPill key="s" status={w.status} />,
                  ])}
                  empty="Nenhum saque solicitado"
                />
              )}

              {tab === "historico" && (
                <Table
                  head={["Data", "Ação", "Antes", "Depois", "Motivo"]}
                  rows={(detail?.logs ?? []).map((l) => [
                    dateTime(l.created_at),
                    l.action,
                    l.old_value || "—",
                    l.new_value || "—",
                    l.note || "—",
                  ])}
                  empty="Nenhuma alteração registrada"
                />
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  )
}

function Metric({
  icon: Icon,
  label: text,
  value,
}: {
  icon: typeof Wallet
  label: string
  value: string
}) {
  return (
    <div className={card}>
      <Icon className="h-4 w-4 text-[#f97316]" />
      <p className={`mt-2 ${label}`}>{text}</p>
      <p className="mt-0.5 text-base font-semibold text-white">{value}</p>
    </div>
  )
}

function Item({ label: text, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className={label}>{text}</dt>
      <dd className="mt-0.5 text-sm font-medium text-white">{value}</dd>
    </div>
  )
}

function Field({ label: text, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm text-white/70">{text}</span>
      {children}
      {hint && <span className="text-[11px] text-white/30">{hint}</span>}
    </label>
  )
}

export function StatusPill({ status }: { status: string }) {
  const s = String(status).toLowerCase()
  const style =
    s === "approved" || s === "completed"
      ? "bg-[#22c55e]/15 text-[#22c55e]"
      : s === "rejected"
        ? "bg-red-500/15 text-red-400"
        : "bg-yellow-500/15 text-yellow-400"
  const text = s === "approved" || s === "completed" ? "Pago" : s === "rejected" ? "Recusado" : "Pendente"
  return <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${style}`}>{text}</span>
}

function Table({
  head,
  rows,
  empty,
}: {
  head: string[]
  rows: React.ReactNode[][]
  empty: string
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-white/40">{empty}</p>
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-[#1F2933]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[#1F2933] bg-[#0a0e17]">
            {head.map((h) => (
              <th key={h} className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wide text-white/40">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-[#1F2933] last:border-0">
              {row.map((cell, j) => (
                <td key={j} className="px-3 py-2.5 align-top text-white/70">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
