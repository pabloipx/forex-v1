"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Copy } from "lucide-react"
import { fmtBrl, useUsdBrlQuote } from "@/components/deposit/pix-conversion"
import { Badge, DataTable, ErrorNote, Panel, SmallButton, Stat, td } from "./ui"
import { ReasonForm } from "./reason-form"
import { adminAction, dateTime, refreshAdmin, useAdminView, usd } from "./use-admin"
import { cn } from "@/lib/utils"

interface WithdrawalRow {
  id: string
  user_id: string
  email: string
  full_name: string | null
  amount: number
  method: string
  destination: Record<string, string | null>
  status: string
  rejection_reason: string | null
  created_at: string
  reviewed_at: string | null
  kyc_status: string
}

const FILTERS = [
  { id: "open", label: "Em aberto", match: (s: string) => s === "pending" || s === "approved" },
  { id: "paid", label: "Pagos", match: (s: string) => s === "paid" },
  { id: "rejected", label: "Rejeitados", match: (s: string) => s === "rejected" || s === "cancelled" },
  { id: "all", label: "Todos", match: () => true },
] as const

const STATUS: Record<string, { label: string; tone: "up" | "down" | "accent" | "muted" }> = {
  pending: { label: "Pendente", tone: "accent" },
  approved: { label: "Aprovado · aguardando pagamento", tone: "accent" },
  paid: { label: "Pago", tone: "up" },
  rejected: { label: "Rejeitado · estornado", tone: "down" },
  cancelled: { label: "Cancelado", tone: "muted" },
}

const PIX_TYPE_LABEL: Record<string, string> = { cpf: "CPF", email: "E-mail", phone: "Celular", random: "Aleatória" }

function destinationText(row: WithdrawalRow) {
  const d = row.destination ?? {}
  if (row.method === "crypto") return { primary: d.wallet ?? "—", secondary: d.crypto_type?.toUpperCase() ?? "Cripto" }
  return { primary: d.pix_key ?? "—", secondary: `PIX ${PIX_TYPE_LABEL[d.pix_key_type ?? ""] ?? d.pix_key_type ?? ""}`.trim() }
}

function copyText(text: string, label = "Copiado") {
  navigator.clipboard.writeText(text).then(
    () => toast.success(label),
    () => toast.error("Não foi possível copiar"),
  )
}

export function WithdrawalsSection() {
  const { data, error } = useAdminView<WithdrawalRow[]>("withdrawals", 10000)
  const { data: quote } = useUsdBrlQuote()
  const rate = quote?.market_rate ?? null
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("open")
  const [busy, setBusy] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<string | null>(null)

  const act = async (row: WithdrawalRow, status: "approved" | "paid" | "rejected", reason?: string) => {
    setBusy(row.id)
    try {
      await adminAction({ action: "review_withdrawal", id: row.id, status, reason: reason ?? null })
      await refreshAdmin("withdrawals", "users", "overview")
      setRejecting(null)
      toast.success(
        status === "paid" ? "Saque marcado como pago" : status === "approved" ? "Saque aprovado" : "Saque rejeitado e valor estornado",
      )
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const copy = (text: string) => copyText(text)
  const money = (v: number) => `US$ ${usd(v)}`
  const brlOf = (v: number) => (rate ? `≈ R$ ${fmtBrl(v * rate)}` : null)

  const all = data ?? []
  const queue = all.filter((r) => r.status === "pending" || r.status === "approved")
  const match = FILTERS.find((f) => f.id === filter)!.match
  const rows = all.filter((r) => match(r.status))
  const pending = all.filter((r) => r.status === "pending")
  const approved = all.filter((r) => r.status === "approved")
  const sum = (arr: WithdrawalRow[]) => arr.reduce((s, r) => s + r.amount, 0)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Aguardando análise" value={String(pending.length)} tone={pending.length ? "accent" : undefined} hint={money(sum(pending))} />
        <Stat label="Aprovados a pagar" value={String(approved.length)} hint={money(sum(approved))} />
        <Stat label="Pagos (lista)" value={money(sum(all.filter((r) => r.status === "paid")))} tone="up" />
        <Stat label="Estornados (lista)" value={money(sum(all.filter((r) => r.status === "rejected")))} tone="down" />
      </div>

      {queue.length > 0 && (
        <section aria-labelledby="payout-queue" className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3 px-1">
            <h2 id="payout-queue" className="text-sm font-semibold">
              {`Fila de pagamento · ${queue.length}`}
            </h2>
            <span className="text-xs text-term-muted">{rate ? `Cotação 1 USD = R$ ${rate.toFixed(4)}` : "Carregando cotação..."}</span>
          </div>
          <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
            {queue.map((r) => (
              <PayoutCard
                key={r.id}
                row={r}
                amountUsd={money(r.amount)}
                amountBrl={brlOf(r.amount)}
                busy={busy === r.id}
                rejecting={rejecting === r.id}
                onApprove={() => act(r, "approved")}
                onPaid={() => act(r, "paid")}
                onReject={() => setRejecting(r.id)}
                onCancelReject={() => setRejecting(null)}
                onConfirmReject={(reason) => act(r, "rejected", reason)}
              />
            ))}
          </div>
        </section>
      )}

      <Panel
        title="Solicitações de saque"
        action={
          <div role="tablist" aria-label="Filtrar saques" className="flex gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                role="tab"
                aria-selected={filter === f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  "rounded px-2.5 py-1 text-xs",
                  filter === f.id ? "bg-term-line text-term-text" : "text-term-muted hover:text-term-text",
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        }
      >
        <ErrorNote error={error} />
        <p className="border-b border-term-line px-4 py-2 text-[11px] leading-relaxed text-term-muted">
          O valor já foi debitado do saldo do cliente na solicitação. Aprovar reserva o pagamento; marcar como pago finaliza;
          rejeitar devolve o valor ao saldo real automaticamente.
        </p>
        <DataTable
          head={["Solicitado", "Cliente", "KYC", "Valor", "Destino", "Status", ""]}
          empty={rows.length === 0 && (data ? "Nenhum saque neste filtro." : "Carregando...")}
        >
          {rows.map((r) => {
            const dest = destinationText(r)
            const open = r.status === "pending" || r.status === "approved"
            return (
              <tr key={r.id} className="border-b border-term-line/60 align-top last:border-0">
                <td className={cn(td, "text-term-muted")}>{dateTime(r.created_at)}</td>
                <td className={cn(td, "font-sans")}>
                  <div className="flex flex-col">
                    <span>{r.full_name ?? "—"}</span>
                    <span className="text-[11px] text-term-muted">{r.email}</span>
                  </div>
                </td>
                <td className={td}>
                  <Badge tone={r.kyc_status === "approved" ? "up" : "down"}>{r.kyc_status === "approved" ? "Verificado" : r.kyc_status}</Badge>
                </td>
                <td className={td}>
                  <div className="flex flex-col">
                    <span className="font-semibold">{money(r.amount)}</span>
                    {brlOf(r.amount) && <span className="text-[11px] text-term-muted">{brlOf(r.amount)}</span>}
                  </div>
                </td>
                <td className={td}>
                  <div className="flex items-center gap-2">
                    <div className="flex max-w-56 flex-col">
                      <span className="truncate">{dest.primary}</span>
                      <span className="font-sans text-[11px] uppercase text-term-muted">
                        {dest.secondary}
                        {r.destination.holder_name ? ` · ${r.destination.holder_name}` : ""}
                      </span>
                    </div>
                    {dest.primary !== "—" && (
                      <button
                        onClick={() => copy(dest.primary)}
                        className="rounded p-1 text-term-muted hover:bg-term-line hover:text-term-text"
                        aria-label="Copiar destino"
                      >
                        <Copy className="size-3.5" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </td>
                <td className={td}>
                  <div className="flex flex-col gap-0.5">
                    <Badge tone={STATUS[r.status]?.tone ?? "muted"}>{STATUS[r.status]?.label ?? r.status}</Badge>
                    {r.rejection_reason && <span className="max-w-48 truncate font-sans text-[11px] text-term-muted">{r.rejection_reason}</span>}
                  </div>
                </td>
                <td className={td}>
                  {open &&
                    (rejecting === r.id ? (
                      <ReasonForm
                        placeholder="Motivo (visível ao cliente)"
                        busy={busy === r.id}
                        onSubmit={(reason) => act(r, "rejected", reason)}
                        onCancel={() => setRejecting(null)}
                      />
                    ) : (
                      <div className="flex gap-1.5">
                        {r.status === "pending" && (
                          <SmallButton tone="accent" disabled={busy === r.id} onClick={() => act(r, "approved")}>
                            Aprovar
                          </SmallButton>
                        )}
                        <SmallButton tone="up" disabled={busy === r.id} onClick={() => act(r, "paid")}>
                          Marcar pago
                        </SmallButton>
                        <SmallButton tone="down" disabled={busy === r.id} onClick={() => setRejecting(r.id)}>
                          Rejeitar
                        </SmallButton>
                      </div>
                    ))}
                </td>
              </tr>
            )
          })}
        </DataTable>
      </Panel>
    </div>
  )
}

function PayoutCard({
  row,
  amountUsd,
  amountBrl,
  busy,
  rejecting,
  onApprove,
  onPaid,
  onReject,
  onCancelReject,
  onConfirmReject,
}: {
  row: WithdrawalRow
  amountUsd: string
  amountBrl: string | null
  busy: boolean
  rejecting: boolean
  onApprove: () => void
  onPaid: () => void
  onReject: () => void
  onCancelReject: () => void
  onConfirmReject: (reason: string) => void
}) {
  const d = row.destination ?? {}
  const isCrypto = row.method === "crypto"
  const fields: { label: string; value: string | null | undefined; mono?: boolean; primary?: boolean }[] = isCrypto
    ? [
        { label: `Carteira ${d.crypto_type?.toUpperCase() ?? ""} · ERC-20`.trim(), value: d.wallet, mono: true, primary: true },
        { label: "Titular", value: d.holder_name ?? row.full_name },
      ]
    : [
        { label: `Chave PIX · ${PIX_TYPE_LABEL[d.pix_key_type ?? ""] ?? d.pix_key_type ?? "—"}`, value: d.pix_key, mono: true, primary: true },
        { label: "Titular", value: d.holder_name ?? row.full_name },
        { label: "CPF/CNPJ", value: d.document, mono: true },
      ]

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-term-line bg-term-panel">
      <header className="flex items-start justify-between gap-3 border-b border-term-line px-4 py-3">
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold">{row.full_name ?? row.email}</span>
          <span className="truncate text-xs text-term-muted">{`${row.email} · ${dateTime(row.created_at)}`}</span>
        </div>
        <Badge tone={row.status === "approved" ? "up" : "accent"}>{row.status === "approved" ? "Aprovado" : "Pendente"}</Badge>
      </header>

      <div className="flex items-end justify-between gap-3 px-4 pt-4">
        <div className="flex flex-col">
          <span className="text-xs text-term-muted">Valor a pagar</span>
          <span className="font-mono text-2xl font-semibold tabular-nums">{amountUsd}</span>
        </div>
        {amountBrl && <span className="pb-1 font-mono text-sm tabular-nums text-term-muted">{amountBrl}</span>}
      </div>

      <dl className="m-4 flex flex-col divide-y divide-term-line rounded-lg border border-term-line bg-term-bg">
        {fields.map((f) => (
          <div key={f.label} className="flex items-center justify-between gap-3 px-3 py-2.5">
            <div className="flex min-w-0 flex-col gap-0.5">
              <dt className="text-[11px] text-term-muted">{f.label}</dt>
              <dd className={cn("break-all text-sm", f.mono && "font-mono", f.primary && "font-semibold text-term-text")}>{f.value || "—"}</dd>
            </div>
            {f.value && (
              <button
                type="button"
                onClick={() => copyText(f.value!, `${f.label.split(" · ")[0]} copiado`)}
                className="flex size-8 shrink-0 items-center justify-center rounded-md text-term-muted transition-colors hover:bg-term-line hover:text-term-text"
                aria-label={`Copiar ${f.label}`}
              >
                <Copy className="size-4" aria-hidden="true" />
              </button>
            )}
          </div>
        ))}
      </dl>

      <footer className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-term-line px-4 py-3">
        <Badge tone={row.kyc_status === "approved" ? "up" : "down"}>{row.kyc_status === "approved" ? "KYC verificado" : `KYC ${row.kyc_status}`}</Badge>
        {rejecting ? (
          <ReasonForm placeholder="Motivo (visível ao cliente)" busy={busy} onSubmit={onConfirmReject} onCancel={onCancelReject} />
        ) : (
          <div className="flex gap-1.5">
            {row.status === "pending" && (
              <SmallButton tone="accent" disabled={busy} onClick={onApprove}>
                Aprovar
              </SmallButton>
            )}
            <SmallButton tone="up" disabled={busy} onClick={onPaid}>
              Marcar pago
            </SmallButton>
            <SmallButton tone="down" disabled={busy} onClick={onReject}>
              Rejeitar
            </SmallButton>
          </div>
        )}
      </footer>
    </article>
  )
}
