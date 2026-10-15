"use client"

import { useDeferredValue, useMemo, useState, type FormEvent } from "react"
import { UserLogsDialog } from "./user-logs-dialog"
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

const kycTone = (s: string) => (s === "approved" ? "up" : s === "rejected" ? "down" : "accent")
const kycLabel: Record<string, string> = { approved: "Aprovado", rejected: "Rejeitado", pending: "Pendente", submitted: "Em análise" }

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
      toast.success(`Saldo atualizado: ${usd(res.balance)} USDT`)
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
              Real ({usd(user?.balance_real)})
            </button>
            <button type="button" role="radio" aria-checked={isDemo} className={seg(isDemo)} onClick={() => setIsDemo(true)}>
              Demo ({usd(user?.balance_demo)})
            </button>
          </div>
          <label className="flex flex-col gap-1.5 text-xs text-term-muted">
            Valor (USDT)
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

export function UsersSection() {
  const { data, error } = useAdminView<UserRow[]>("users", 30000)
  const adjustments = useAdminView<Adjustment[]>("adjustments")
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query)
  const [adjusting, setAdjusting] = useState<UserRow | null>(null)
  const [viewingLogs, setViewingLogs] = useState<UserRow | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const toggleBlock = async (u: UserRow) => {
    setBusy(u.id)
    try {
      await adminAction({ action: "block_user", userId: u.id, blocked: !u.is_blocked })
      await refreshAdmin("users", "overview")
      toast.success(u.is_blocked ? "Usuário desbloqueado" : "Usuário bloqueado para novas posições")
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
          head={["Cliente", "Telefone", "País", "KYC", "Saldo real", "Saldo demo", "Posições", "Cadastro", "Status", ""]}
          empty={rows.length === 0 && "Nenhum usuário encontrado."}
        >
          {rows.map((u) => (
            <tr key={u.id} className="border-b border-term-line/60 last:border-0">
              <td className={cn(td, "font-sans")}>
                <div className="flex flex-col">
                  <span className="font-medium">{u.full_name || "—"}</span>
                  <span className="text-term-muted">{u.email}</span>
                </div>
              </td>
              <td className={td}>{u.phone ?? "—"}</td>
              <td className={cn(td, "font-sans")}>{u.country ?? "—"}</td>
              <td className={td}>
                <Badge tone={kycTone(u.kyc_status)}>{kycLabel[u.kyc_status] ?? u.kyc_status}</Badge>
              </td>
              <td className={td}>{usd(u.balance_real)}</td>
              <td className={cn(td, "text-term-muted")}>{usd(u.balance_demo)}</td>
              <td className={td}>{u.open_positions}</td>
              <td className={cn(td, "text-term-muted")}>{dateTime(u.created_at)}</td>
              <td className={td}>{u.is_blocked ? <Badge tone="down">Bloqueado</Badge> : <Badge tone="up">Ativo</Badge>}</td>
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
              <td className={cn(td, a.amount >= 0 ? "text-long" : "text-short")}>{signedUsd(a.amount)}</td>
              <td className={td}>{usd(a.balance_after)}</td>
              <td className={cn(td, "font-sans text-term-muted")}>{a.note ?? "—"}</td>
            </tr>
          ))}
        </DataTable>
      </Panel>

      <AdjustDialog user={adjusting} onClose={() => setAdjusting(null)} />
      <UserLogsDialog user={viewingLogs} onClose={() => setViewingLogs(null)} />
    </div>
  )
}
