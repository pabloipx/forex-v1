"use client"

import { useDeferredValue, useMemo, useState, type FormEvent } from "react"
import { UserLogsDialog } from "./user-logs-dialog"
import { UserDetailSheet } from "./user-detail-sheet"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge, DataTable, ErrorNote, Panel, SmallButton, inputCls, td } from "./ui"
import { adminAction, dateTime, refreshAdmin, signedUsd, usd, useAdminView } from "./use-admin"
import { cn } from "@/lib/utils"

interface UserRow {
  id: string
  email: string
  full_name: string | null
  phone: string | null
  country: string | null
  kyc_status: string
  is_blocked: boolean
  blocked_reason?: string | null
  balance_real: number
  balance_demo: number
  open_positions: number
  created_at: string | null
  last_login_at: string | null
}

interface Adjustment {
  id: string
  email: string
  is_demo: boolean
  amount: number
  balance_after: number
  note: string | null
  created_at: string
}

const kycTone = (s: string) =>
  s === "approved" ? "up" : s === "rejected" ? "down" : s === "pending" || s === "submitted" ? "accent" : "muted"
const kycLabel: Record<string, string> = {
  approved: "Aprovado",
  rejected: "Rejeitado",
  pending: "Pendente",
  submitted: "Em análise",
  not_started: "Não enviado",
}
const money = (v: number | null | undefined) => `US$ ${usd(v)}`

function AdjustDialog({ user, onClose }: { user: UserRow | null; onClose: () => void }) {
  const [direction, setDirection] = useState<"credit" | "debit">("credit")
  const [isDemo, setIsDemo] = useState(false)
  const [amount, setAmount] = useState("")
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!user) return
    const value = Number(amount.replace(",", "."))
    if (!(value > 0)) return toast.error("Informe um valor positivo")
    setBusy(true)
    try {
      const res = await adminAction<{ balance: number }>({
        action: "adjust_balance",
        userId: user.id,
        isDemo,
        amount: direction === "credit" ? value : -value,
        note: note || null,
      })
      toast.success(`Saldo atualizado: ${money(res.balance)}`)
      await refreshAdmin("users", "adjustments", "overview")
      setAmount("")
      setNote("")
      onClose()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const seg = (active: boolean) =>
    cn("flex-1 rounded py-1.5 text-xs font-medium", active ? "bg-term-line text-term-text" : "text-term-muted hover:text-term-text")

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="border-term-line bg-term-panel text-term-text">
        <DialogHeader>
          <DialogTitle>Ajustar saldo</DialogTitle>
          <DialogDescription className="text-term-muted">{user?.email}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex gap-1 rounded-md bg-term-bg p-1" role="radiogroup" aria-label="Operação">
            <button type="button" role="radio" aria-checked={direction === "credit"} className={seg(direction === "credit")} onClick={() => setDirection("credit")}>
              Creditar
            </button>
            <button type="button" role="radio" aria-checked={direction === "debit"} className={seg(direction === "debit")} onClick={() => setDirection("debit")}>
              Debitar
            </button>
          </div>
          <div className="flex gap-1 rounded-md bg-term-bg p-1" role="radiogroup" aria-label="Conta">
            <button type="button" role="radio" aria-checked={!isDemo} className={seg(!isDemo)} onClick={() => setIsDemo(false)}>
              Saldo ({money(user?.balance_real)})
            </button>
            <button type="button" role="radio" aria-checked={isDemo} className={seg(isDemo)} onClick={() => setIsDemo(true)}>
              Demo ({money(user?.balance_demo)})
            </button>
          </div>
          <label className="flex flex-col gap-1.5 text-xs text-term-muted">
            Valor (US$)
            <input className={inputCls} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" required />
          </label>
          <label className="flex flex-col gap-1.5 text-xs text-term-muted">
            Motivo (registrado no histórico)
            <input className={cn(inputCls, "font-sans")} value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="Ex.: depósito via PIX #123" />
          </label>
          <SmallButton type="submit" tone={direction === "credit" ? "up" : "down"} disabled={busy}>
            {busy ? "Processando..." : direction === "credit" ? "Creditar saldo" : "Debitar saldo"}
          </SmallButton>
        </form>
      </DialogContent>
    </Dialog>
  )
}

const BLOCK_REASON_PRESETS = [
  "Violação dos termos de uso",
  "Suspeita de fraude",
  "Documentos falsos ou inconsistentes",
  "Múltiplas contas",
  "Solicitação do próprio cliente",
]

function BlockDialog({ user, onClose }: { user: UserRow | null; onClose: () => void }) {
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)

  const close = () => {
    setReason("")
    onClose()
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!user) return
    const text = reason.trim()
    if (text.length < 3) return toast.error("Informe o motivo do bloqueio")
    setBusy(true)
    try {
      await adminAction({ action: "block_user", userId: user.id, blocked: true, reason: text })
      await refreshAdmin("users", "overview")
      toast.success("Conta bloqueada. O cliente verá o motivo ao tentar entrar.")
      close()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && close()}>
      <DialogContent className="border-term-line bg-term-panel text-term-text">
        <DialogHeader>
          <DialogTitle>Bloquear conta</DialogTitle>
          <DialogDescription className="text-term-muted">
            {user?.full_name ? `${user.full_name} · ` : ""}
            {user?.email}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-1.5" aria-label="Motivos frequentes">
            {BLOCK_REASON_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setReason(preset)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-xs transition-colors",
                  reason === preset
                    ? "border-short bg-short/15 text-short"
                    : "border-term-line text-term-muted hover:text-term-text",
                )}
              >
                {preset}
              </button>
            ))}
          </div>
          <label className="flex flex-col gap-1.5 text-xs text-term-muted">
            Motivo do bloqueio (o cliente verá este texto ao tentar entrar)
            <textarea
              className={cn(inputCls, "min-h-24 resize-y font-sans leading-relaxed")}
              value={reason}
              maxLength={500}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Descreva o motivo do bloqueio"
              required
            />
            <span className="self-end tabular-nums">{reason.length}/500</span>
          </label>
          <p className="text-xs leading-relaxed text-term-muted">
            O cliente será desconectado de todos os dispositivos e não conseguirá entrar até ser desbloqueado.
          </p>
          <SmallButton type="submit" tone="down" disabled={busy}>
            {busy ? "Bloqueando..." : "Bloquear conta"}
          </SmallButton>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function UsersSection() {
  const { data, error } = useAdminView<UserRow[]>("users", 30000)
  const adjustments = useAdminView<Adjustment[]>("adjustments")
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query)
  const [adjusting, setAdjusting] = useState<UserRow | null>(null)
  const [viewingLogs, setViewingLogs] = useState<UserRow | null>(null)
  const [viewingDetail, setViewingDetail] = useState<UserRow | null>(null)
  const [blocking, setBlocking] = useState<UserRow | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const toggleBlock = async (u: UserRow) => {
    if (!u.is_blocked) return setBlocking(u)
    setBusy(u.id)
    try {
      await adminAction({ action: "block_user", userId: u.id, blocked: false })
      await refreshAdmin("users", "overview")
      toast.success("Usuário desbloqueado")
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const rows = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase()
    if (!q) return data ?? []
    return (data ?? []).filter(
      (u) => u.email.toLowerCase().includes(q) || (u.full_name ?? "").toLowerCase().includes(q) || (u.phone ?? "").includes(q),
    )
  }, [data, deferredQuery])

  return (
    <div className="flex flex-col gap-4">
      <input
        type="search"
        placeholder="Buscar por nome, e-mail ou telefone"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className={cn(inputCls, "max-w-sm font-sans")}
        aria-label="Buscar usuários"
      />
      <Panel title={`Usuários (${rows.length})`}>
        <ErrorNote error={error} />
        <DataTable
          head={["Cliente", "Contato", "KYC", "Saldo (USD)", "Demo (USD)", "Posições", "Cadastro", "Status", "Ações"]}
          empty={rows.length === 0 && "Nenhum usuário encontrado."}
        >
          {rows.map((u) => (
            <tr key={u.id} className="border-b border-term-line/60 last:border-0">
              <td className={cn(td, "font-sans")}>
                <button
                  type="button"
                  onClick={() => setViewingDetail(u)}
                  className="group flex flex-col rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-term-accent"
                  aria-label={`Abrir detalhes de ${u.full_name || u.email}`}
                >
                  <span className="text-sm font-medium group-hover:text-primary group-hover:underline">
                    {u.full_name || "Sem nome"}
                  </span>
                  <span className="text-term-muted">{u.email}</span>
                </button>
              </td>
              <td className={td}>
                <span className="flex flex-col">
                  <span>{u.phone ?? "—"}</span>
                  <span className="font-sans text-term-muted">{u.country ?? "—"}</span>
                </span>
              </td>
              <td className={td}>
                <Badge tone={kycTone(u.kyc_status)}>{kycLabel[u.kyc_status] ?? u.kyc_status}</Badge>
              </td>
              <td className={cn(td, "text-sm font-semibold", u.balance_real > 0 ? "text-term-text" : "text-term-muted")}>
                {money(u.balance_real)}
              </td>
              <td className={cn(td, "text-term-muted")}>{money(u.balance_demo)}</td>
              <td className={cn(td, u.open_positions > 0 ? "text-term-text" : "text-term-muted")}>{u.open_positions}</td>
              <td className={cn(td, "text-term-muted")}>{dateTime(u.created_at)}</td>
              <td className={td}>
                {u.is_blocked ? (
                  <span className="flex max-w-48 flex-col items-start gap-1">
                    <Badge tone="down">Bloqueado</Badge>
                    {u.blocked_reason ? (
                      <span className="truncate font-sans text-term-muted" title={u.blocked_reason}>
                        {u.blocked_reason}
                      </span>
                    ) : null}
                  </span>
                ) : (
                  <Badge tone="up">Ativo</Badge>
                )}
              </td>
              <td className={td}>
                <div className="flex gap-1.5">
                  <SmallButton tone="muted" onClick={() => setViewingLogs(u)}>
                    Logs
                  </SmallButton>
                  <SmallButton tone="accent" onClick={() => setAdjusting(u)}>
                    Saldo
                  </SmallButton>
                  <SmallButton tone={u.is_blocked ? "muted" : "down"} disabled={busy === u.id} onClick={() => toggleBlock(u)}>
                    {u.is_blocked ? "Desbloquear" : "Bloquear"}
                  </SmallButton>
                </div>
              </td>
            </tr>
          ))}
        </DataTable>
      </Panel>

      <Panel title="Histórico de ajustes de saldo">
        <DataTable
          head={["Data", "Cliente", "Conta", "Valor", "Saldo após", "Motivo"]}
          empty={(adjustments.data ?? []).length === 0 && "Nenhum ajuste realizado."}
        >
          {(adjustments.data ?? []).map((a) => (
            <tr key={a.id} className="border-b border-term-line/60 last:border-0">
              <td className={cn(td, "text-term-muted")}>{dateTime(a.created_at)}</td>
              <td className={cn(td, "font-sans")}>{a.email}</td>
              <td className={td}>{a.is_demo ? <Badge>demo</Badge> : <Badge tone="accent">real</Badge>}</td>
              <td className={cn(td, a.amount >= 0 ? "text-long" : "text-short")}>{`${signedUsd(a.amount)} US$`}</td>
              <td className={td}>{money(a.balance_after)}</td>
              <td className={cn(td, "font-sans text-term-muted")}>{a.note ?? "—"}</td>
            </tr>
          ))}
        </DataTable>
      </Panel>

      <AdjustDialog user={adjusting} onClose={() => setAdjusting(null)} />
      <BlockDialog user={blocking} onClose={() => setBlocking(null)} />
      <UserLogsDialog user={viewingLogs} onClose={() => setViewingLogs(null)} />
      <UserDetailSheet user={viewingDetail} onClose={() => setViewingDetail(null)} />
    </div>
  )
}
