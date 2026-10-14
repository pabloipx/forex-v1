"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Copy } from "lucide-react"
import { Badge, DataTable, ErrorNote, Panel, SmallButton, Stat, td } from "./ui"
import { ReasonForm } from "./reason-form"
import { adminAction, brl, dateTime, refreshAdmin, useAdminView } from "./use-admin"
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

function destinationText(row: WithdrawalRow) {
  const d = row.destination
  if (row.method === "crypto") return { primary: d.wallet ?? "—", secondary: d.crypto_type?.toUpperCase() ?? "Cripto" }
  return { primary: d.pix_key ?? "—", secondary: `PIX ${d.pix_key_type ?? ""}`.trim() }
}

export function WithdrawalsSection() {
  const { data, error } = useAdminView<WithdrawalRow[]>("withdrawals", 10000)
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

  const copy = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => toast.success("Copiado"),
      () => toast.error("Não foi possível copiar"),
    )
  }

  const all = data ?? []
  const match = FILTERS.find((f) => f.id === filter)!.match
  const rows = all.filter((r) => match(r.status))
  const pending = all.filter((r) => r.status === "pending")
  const approved = all.filter((r) => r.status === "approved")
  const sum = (arr: WithdrawalRow[]) => arr.reduce((s, r) => s + r.amount, 0)

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Aguardando análise" value={String(pending.length)} tone={pending.length ? "accent" : undefined} hint={brl(sum(pending))} />
        <Stat label="Aprovados a pagar" value={String(approved.length)} hint={brl(sum(approved))} />
        <Stat label="Pagos (lista)" value={brl(sum(all.filter((r) => r.status === "paid")))} tone="up" />
        <Stat label="Estornados (lista)" value={brl(sum(all.filter((r) => r.status === "rejected")))} tone="down" />
      </div>

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
                <td className={cn(td, "font-semibold")}>{brl(r.amount)}</td>
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
