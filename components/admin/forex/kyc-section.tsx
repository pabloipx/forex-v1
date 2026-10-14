"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Badge, DataTable, ErrorNote, Panel, SmallButton, td } from "./ui"
import { adminAction, dateTime, refreshAdmin, useAdminView } from "./use-admin"
import { cn } from "@/lib/utils"
import { ReasonForm } from "./reason-form"

const KYC_LABEL: Record<string, string> = { pending: "Em análise", approved: "Aprovado", rejected: "Rejeitado" }

interface KycRow {
  id: string
  user_id: string
  email: string
  document_type: string | null
  status: string
  review_notes: string | null
  created_at: string
  files: { label: string; path: string | null }[]
}

export function KycSection() {
  const { data, error } = useAdminView<KycRow[]>("kyc", 15000)
  const [busy, setBusy] = useState<string | null>(null)
  const [onlyPending, setOnlyPending] = useState(true)
  const [rejecting, setRejecting] = useState<string | null>(null)

  const openFile = async (path: string) => {
    const win = window.open("", "_blank")
    if (win) win.opener = null
    try {
      const { url } = await adminAction<{ url: string }>({ action: "kyc_file", path })
      if (win) win.location.href = url
      else window.location.assign(url)
    } catch (e) {
      win?.close()
      toast.error((e as Error).message)
    }
  }

  const review = async (row: KycRow, approve: boolean, reason: string | null = null) => {
    setBusy(row.id)
    try {
      await adminAction({ action: "review_kyc", id: row.id, approve, reason })
      await refreshAdmin("kyc", "users", "overview")
      setRejecting(null)
      toast.success(approve ? "Documento aprovado" : "Documento rejeitado")
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const rows = (data ?? []).filter((r) => !onlyPending || r.status === "pending" || r.status === "submitted")

  return (
    <Panel
      title="Verificação de identidade (KYC)"
      action={
        <label className="flex items-center gap-2 text-xs text-term-muted">
          <input type="checkbox" checked={onlyPending} onChange={(e) => setOnlyPending(e.target.checked)} className="accent-primary" />
          Somente pendentes
        </label>
      }
    >
      <ErrorNote error={error} />
      <DataTable
        head={["Enviado", "Cliente", "Documento", "Arquivos", "Status", ""]}
        empty={rows.length === 0 && data ? "Nenhuma solicitação neste filtro." : "Carregando..."}
      >
        {rows.map((r) => (
          <tr key={r.id} className="border-b border-term-line/60 last:border-0">
            <td className={cn(td, "text-term-muted")}>{dateTime(r.created_at)}</td>
            <td className={cn(td, "font-sans")}>{r.email}</td>
            <td className={cn(td, "font-sans uppercase")}>{r.document_type ?? "—"}</td>
            <td className={td}>
              <div className="flex gap-1.5">
                {r.files.map((f) =>
                  f.path ? (
                    <SmallButton key={f.label} onClick={() => openFile(f.path!)}>
                      {f.label}
                    </SmallButton>
                  ) : null,
                )}
              </div>
            </td>
            <td className={td}>
              <div className="flex flex-col gap-0.5">
                <Badge tone={r.status === "approved" ? "up" : r.status === "rejected" ? "down" : "accent"}>
                  {KYC_LABEL[r.status] ?? r.status}
                </Badge>
                {r.review_notes && <span className="max-w-48 truncate font-sans text-[11px] text-term-muted">{r.review_notes}</span>}
              </div>
            </td>
            <td className={td}>
              {rejecting === r.id ? (
                <ReasonForm
                  placeholder="Motivo (enviado ao cliente)"
                  busy={busy === r.id}
                  onSubmit={(reason) => review(r, false, reason)}
                  onCancel={() => setRejecting(null)}
                />
              ) : (
                <div className="flex gap-1.5">
                  <SmallButton tone="up" disabled={busy === r.id || r.status === "approved"} onClick={() => review(r, true)}>
                    Aprovar
                  </SmallButton>
                  <SmallButton tone="down" disabled={busy === r.id || r.status === "rejected"} onClick={() => setRejecting(r.id)}>
                    Rejeitar
                  </SmallButton>
                </div>
              )}
            </td>
          </tr>
        ))}
      </DataTable>
    </Panel>
  )
}
