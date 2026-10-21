"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Badge, DataTable, ErrorNote, Panel, SmallButton, Stat, td } from "./ui"
import { adminAction, brl, dateTime, refreshAdmin, useAdminView } from "./use-admin"
import { cn } from "@/lib/utils"

interface DepositRow {
  id: string
  email: string
  account_type: string
  amount: number
  method: string | null
  provider: string | null
  external_id: string | null
  status: string
  created_at: string
  confirmed_at: string | null
  crypto: { currency: string; network: string; amount_usd: number; tx_hash: string } | null
}

const STATUS: Record<string, { label: string; tone: "up" | "down" | "accent" | "muted" }> = {
  pending: { label: "Pendente", tone: "accent" },
  confirmed: { label: "Confirmado", tone: "up" },
  approved: { label: "Pago (automático)", tone: "up" },
  cancelled: { label: "Cancelado", tone: "muted" },
  refunded: { label: "Estornado", tone: "down" },
  failed: { label: "Recusado", tone: "down" },
  expired: { label: "Expirado", tone: "muted" },
}

export function DepositsSection() {
  const { data, error } = useAdminView<DepositRow[]>("deposits", 10000)
  const [onlyPending, setOnlyPending] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)

  const review = async (row: DepositRow, confirm: boolean) => {
    setBusy(row.id)
    try {
      await adminAction({ action: "review_deposit", id: row.id, confirm })
      await refreshAdmin("deposits", "users", "overview")
      setConfirming(null)
      toast.success(confirm ? `${brl(row.amount)} creditado na conta ${row.account_type}` : "Depósito recusado")
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const all = data ?? []
  const rows = onlyPending ? all.filter((r) => r.status === "pending") : all
  const dayAgo = Date.now() - 86400_000
  const confirmed = all.filter((r) => (r.status === "confirmed" || r.status === "approved") && r.account_type === "real")
  const sum = (arr: DepositRow[]) => arr.reduce((s, r) => s + r.amount, 0)
  const pending = all.filter((r) => r.status === "pending")

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Pendentes" value={String(pending.length)} tone={pending.length ? "accent" : undefined} hint={brl(sum(pending))} />
        <Stat
          label="Confirmados 24h (real)"
          value={brl(sum(confirmed.filter((r) => r.confirmed_at && new Date(r.confirmed_at).getTime() >= dayAgo)))}
          tone="up"
        />
        <Stat label="Confirmados (lista, real)" value={brl(sum(confirmed))} />
        <Stat label="Recusados/expirados" value={String(all.filter((r) => r.status === "failed" || r.status === "expired").length)} />
      </div>

      <Panel
        title="Depósitos"
        action={
          <label className="flex items-center gap-2 text-xs text-term-muted">
            <input type="checkbox" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} className="accent-primary" />
            Somente pendentes
          </label>
        }
      >
        <ErrorNote error={error} />
        <p className="border-b border-term-line px-4 py-2 text-[11px] leading-relaxed text-term-muted">
          Depósitos em cripto são aprovados manualmente: confira o hash (clique para copiar) no explorer da rede antes de confirmar. A confirmação credita o saldo do cliente uma única vez.
        </p>
        <DataTable
          head={["Criado", "Cliente", "Conta", "Valor", "Método", "Referência", "Status", ""]}
          empty={rows.length === 0 && (data ? "Nenhum depósito." : "Carregando...")}
        >
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-term-line/60 last:border-0">
              <td className={cn(td, "text-term-muted")}>{dateTime(r.created_at)}</td>
              <td className={cn(td, "font-sans")}>{r.email}</td>
              <td className={td}>
                <Badge tone={r.account_type === "real" ? "accent" : "muted"}>{r.account_type === "real" ? "Real" : "Demo"}</Badge>
              </td>
              <td className={cn(td, "font-semibold")}>
                {brl(r.amount)}
                {r.crypto && <span className="block text-[11px] font-normal text-term-muted">${r.crypto.amount_usd} USD</span>}
              </td>
              <td className={cn(td, "font-sans uppercase")}>
                {r.crypto ? (
                  <span className="flex flex-col">
                    <span>{r.crypto.currency}</span>
                    <span className="text-[11px] normal-case text-term-muted">Rede {r.crypto.network}</span>
                  </span>
                ) : (
                  [r.method, r.provider].filter(Boolean).join(" · ") || "—"
                )}
              </td>
              <td className={cn(td, "max-w-40 text-term-muted")}>
                {r.external_id ? (
                  <button
                    type="button"
                    title={r.external_id}
                    onClick={() => {
                      navigator.clipboard.writeText(r.external_id ?? "").then(
                        () => toast.success("Hash copiado"),
                        () => toast.error("Não foi possível copiar"),
                      )
                    }}
                    className="block max-w-40 truncate text-left hover:text-term-text"
                  >
                    {r.external_id}
                  </button>
                ) : (
                  "—"
                )}
              </td>
              <td className={td}>
                <Badge tone={STATUS[r.status]?.tone ?? "muted"}>{STATUS[r.status]?.label ?? r.status}</Badge>
              </td>
              <td className={td}>
                {r.status === "pending" &&
                  (confirming === r.id ? (
                    <div className="flex items-center gap-1.5">
                      <span className="font-sans text-[11px] text-term-muted">Creditar {brl(r.amount)}?</span>
                      <SmallButton tone="up" disabled={busy === r.id} onClick={() => review(r, true)}>
                        Sim, creditar
                      </SmallButton>
                      <SmallButton onClick={() => setConfirming(null)}>Voltar</SmallButton>
                    </div>
                  ) : (
                    <div className="flex gap-1.5">
                      <SmallButton tone="up" disabled={busy === r.id} onClick={() => setConfirming(r.id)}>
                        Confirmar
                      </SmallButton>
                      <SmallButton tone="down" disabled={busy === r.id} onClick={() => review(r, false)}>
                        Recusar
                      </SmallButton>
                    </div>
                  ))}
              </td>
            </tr>
          ))}
        </DataTable>
      </Panel>
    </div>
  )
}
