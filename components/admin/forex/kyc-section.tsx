"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import { Check, ExternalLink, FileText, Search, X } from "lucide-react"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Badge, ErrorNote, Panel, SmallButton, inputCls } from "./ui"
import { adminAction, dateTime, refreshAdmin, useAdminView } from "./use-admin"
import { cn } from "@/lib/utils"

interface KycRow {
  id: string
  user_id: string
  email: string
  full_name: string | null
  phone: string | null
  document_type: string | null
  status: string
  review_notes: string | null
  created_at: string
  reviewed_at: string | null
  files: { label: string; path: string | null }[]
}

type Group = "pending" | "approved" | "rejected"
type Filter = "inbox" | Group | "all"

const groupOf = (s: string): Group => (s === "approved" ? "approved" : s === "rejected" ? "rejected" : "pending")

const STATUS: Record<Group, { label: string; tone: "accent" | "up" | "down" }> = {
  pending: { label: "Pendente", tone: "accent" },
  approved: { label: "Aprovado", tone: "up" },
  rejected: { label: "Recusado", tone: "down" },
}

const FILTERS: { id: Filter; label: string }[] = [
  { id: "inbox", label: "Pendentes e aprovados" },
  { id: "pending", label: "Pendentes" },
  { id: "approved", label: "Aprovados" },
  { id: "rejected", label: "Recusados" },
  { id: "all", label: "Todos" },
]

const QUICK_REASONS = [
  "Documento ilegível ou desfocado",
  "Selfie não confere com o documento",
  "Documento vencido",
  "Foto cortada ou incompleta",
  "Faltando frente ou verso",
]

const DOC_LABEL: Record<string, string> = { rg: "RG", cnh: "CNH", passport: "Passaporte", passaporte: "Passaporte" }

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")

export function KycSection() {
  const { data, error } = useAdminView<KycRow[]>("kyc", 15000)
  const [filter, setFilter] = useState<Filter>("inbox")
  const [query, setQuery] = useState("")
  const [openId, setOpenId] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const rows = data ?? []
  const counts = useMemo(() => {
    const c = { pending: 0, approved: 0, rejected: 0 }
    for (const r of rows) c[groupOf(r.status)]++
    return c
  }, [rows])

  const searched = useMemo(() => {
    const q = normalize(query.trim())
    if (!q) return rows
    const digits = q.replace(/\D/g, "")
    return rows.filter((r) => {
      const hay = normalize(`${r.full_name ?? ""} ${r.email} ${r.user_id}`)
      return hay.includes(q) || (digits.length >= 3 && (r.phone ?? "").replace(/\D/g, "").includes(digits))
    })
  }, [rows, query])

  const pendingQueue = useMemo(
    () =>
      searched
        .filter((r) => groupOf(r.status) === "pending")
        .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [searched],
  )

  const open = rows.find((r) => r.id === openId) ?? null

  const review = async (row: KycRow, approve: boolean, reason: string | null = null) => {
    setBusy(row.id)
    try {
      await adminAction({ action: "review_kyc", id: row.id, approve, reason })
      await refreshAdmin("kyc", "users", "overview")
      toast.success(approve ? `${row.full_name || row.email} aprovado` : `${row.full_name || row.email} recusado`)
      if (openId === row.id) {
        const next = pendingQueue.find((r) => r.id !== row.id)
        setOpenId(next?.id ?? null)
      }
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const sections: { group: Group; title: string; items: KycRow[] }[] =
    filter === "inbox"
      ? [
          { group: "pending", title: "Pendentes", items: pendingQueue },
          { group: "approved", title: "Aprovados", items: searched.filter((r) => groupOf(r.status) === "approved") },
        ]
      : filter === "all"
        ? [{ group: "pending", title: "Todos", items: searched }]
        : [
            {
              group: filter,
              title: FILTERS.find((f) => f.id === filter)!.label,
              items: filter === "pending" ? pendingQueue : searched.filter((r) => groupOf(r.status) === filter),
            },
          ]

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        <CountCard label="Pendentes" value={counts.pending} tone="accent" active={filter === "pending"} onClick={() => setFilter("pending")} />
        <CountCard label="Aprovados" value={counts.approved} tone="up" active={filter === "approved"} onClick={() => setFilter("approved")} />
        <CountCard label="Recusados" value={counts.rejected} tone="down" active={filter === "rejected"} onClick={() => setFilter("rejected")} />
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative md:w-96">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-term-muted" aria-hidden />
          <label htmlFor="kyc-search" className="sr-only">
            Buscar cliente
          </label>
          <input
            id="kyc-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar por nome, e-mail ou telefone"
            className={cn(inputCls, "pl-9 font-sans")}
          />
        </div>
        <div role="tablist" aria-label="Filtrar por status" className="flex gap-1 overflow-x-auto rounded-lg bg-term-panel p-1 [scrollbar-width:none]">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                filter === f.id ? "bg-term-line text-term-text" : "text-term-muted hover:text-term-text",
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <ErrorNote error={error} />

      {sections.map((s) => (
        <Panel
          key={s.title}
          title={`${s.title} (${s.items.length})`}
          action={
            s.group === "pending" && filter !== "all" && s.items.length > 0 ? (
              <SmallButton tone="accent" onClick={() => setOpenId(s.items[0].id)}>
                Revisar o próximo
              </SmallButton>
            ) : null
          }
        >
          {!data ? (
            <p className="px-4 py-10 text-center text-xs text-term-muted">Carregando...</p>
          ) : s.items.length === 0 ? (
            <p className="px-4 py-10 text-center text-xs text-term-muted">
              {query ? "Nenhum cliente encontrado com essa busca." : "Nada por aqui."}
            </p>
          ) : (
            <ul className="divide-y divide-term-line/60">
              {s.items.map((r) => (
                <KycListItem
                  key={r.id}
                  row={r}
                  busy={busy === r.id}
                  onOpen={() => setOpenId(r.id)}
                  onApprove={() => review(r, true)}
                />
              ))}
            </ul>
          )}
        </Panel>
      ))}

      <KycReviewSheet
        row={open}
        busy={open ? busy === open.id : false}
        remaining={pendingQueue.filter((r) => r.id !== open?.id).length}
        onClose={() => setOpenId(null)}
        onApprove={(r) => review(r, true)}
        onReject={(r, reason) => review(r, false, reason)}
      />
    </div>
  )
}

function CountCard({
  label,
  value,
  tone,
  active,
  onClick,
}: {
  label: string
  value: number
  tone: "accent" | "up" | "down"
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex flex-col gap-1 rounded-xl border bg-term-panel px-4 py-3 text-left transition-colors",
        active ? "border-primary" : "border-term-line hover:border-term-muted/50",
      )}
    >
      <span className="text-xs text-term-muted">{label}</span>
      <span
        className={cn(
          "font-mono text-xl font-semibold tabular-nums",
          tone === "accent" && "text-primary",
          tone === "up" && "text-long",
          tone === "down" && "text-short",
        )}
      >
        {value}
      </span>
    </button>
  )
}

function KycListItem({
  row,
  busy,
  onOpen,
  onApprove,
}: {
  row: KycRow
  busy: boolean
  onOpen: () => void
  onApprove: () => void
}) {
  const group = groupOf(row.status)
  const fileCount = row.files.filter((f) => f.path).length
  return (
    <li className="flex flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:gap-4">
      <button type="button" onClick={onOpen} className="group flex min-w-0 flex-1 flex-col items-start text-left">
        <span className="truncate text-sm font-medium text-term-text group-hover:text-primary group-hover:underline">
          {row.full_name || "Sem nome"}
        </span>
        <span className="truncate text-xs text-term-muted">
          {row.email}
          {row.phone && ` · ${row.phone}`}
        </span>
      </button>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-term-muted md:w-72">
        <span className="flex items-center gap-1">
          <FileText className="size-3.5" aria-hidden />
          {DOC_LABEL[row.document_type?.toLowerCase() ?? ""] ?? row.document_type?.toUpperCase() ?? "—"} · {fileCount} arquivo
          {fileCount === 1 ? "" : "s"}
        </span>
        <span className="font-mono tabular-nums">{dateTime(group === "pending" ? row.created_at : row.reviewed_at ?? row.created_at)}</span>
      </div>
      <div className="flex items-center gap-2 md:w-64 md:justify-end">
        <Badge tone={STATUS[group].tone}>{STATUS[group].label}</Badge>
        {group === "pending" ? (
          <>
            <SmallButton onClick={onOpen}>Revisar</SmallButton>
            <SmallButton tone="up" disabled={busy} onClick={onApprove}>
              Aprovar
            </SmallButton>
          </>
        ) : (
          <SmallButton onClick={onOpen}>Ver documentos</SmallButton>
        )}
      </div>
    </li>
  )
}

const filesFetcher = async ([, ...paths]: [string, ...string[]]) =>
  Promise.all(
    paths.map((path) =>
      path
        ? adminAction<{ url: string }>({ action: "kyc_file", path })
            .then((r) => r.url)
            .catch(() => null)
        : Promise.resolve(null),
    ),
  )

function KycReviewSheet({
  row,
  busy,
  remaining,
  onClose,
  onApprove,
  onReject,
}: {
  row: KycRow | null
  busy: boolean
  remaining: number
  onClose: () => void
  onApprove: (row: KycRow) => void
  onReject: (row: KycRow, reason: string) => void
}) {
  const [reason, setReason] = useState("")
  const [rejecting, setRejecting] = useState(false)
  const [lastId, setLastId] = useState<string | null>(null)

  if (row && row.id !== lastId) {
    setLastId(row.id)
    setReason("")
    setRejecting(false)
  }

  const paths = row?.files.map((f) => f.path ?? "") ?? []
  const { data: urls, isLoading } = useSWR(row ? ["kyc-files", ...paths] : null, filesFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 240_000,
  })

  const group = row ? groupOf(row.status) : "pending"

  return (
    <Sheet open={!!row} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 border-term-line bg-term-bg p-0 sm:max-w-2xl">
        {row && (
          <>
            <SheetHeader className="border-b border-term-line px-5 py-4 text-left">
              <div className="flex items-center gap-2">
                <SheetTitle className="text-base text-term-text">{row.full_name || "Sem nome"}</SheetTitle>
                <Badge tone={STATUS[group].tone}>{STATUS[group].label}</Badge>
              </div>
              <SheetDescription className="text-xs text-term-muted">
                {row.email}
                {row.phone && ` · ${row.phone}`} · Enviado em {dateTime(row.created_at)}
              </SheetDescription>
            </SheetHeader>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="grid gap-3 sm:grid-cols-2">
                {row.files.map((f, i) => (
                  <figure
                    key={f.label}
                    className={cn(
                      "flex flex-col overflow-hidden rounded-lg border border-term-line bg-term-panel",
                      f.label === "Selfie" && "sm:col-span-2",
                    )}
                  >
                    <figcaption className="flex items-center justify-between px-3 py-2 text-xs text-term-muted">
                      <span className="font-medium text-term-text">{f.label}</span>
                      {urls?.[i] && (
                        <a
                          href={urls[i]!}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 hover:text-primary"
                        >
                          Abrir <ExternalLink className="size-3" aria-hidden />
                        </a>
                      )}
                    </figcaption>
                    <div className="flex aspect-[4/3] items-center justify-center bg-term-bg">
                      {!f.path ? (
                        <span className="text-xs text-term-muted">Não enviado</span>
                      ) : isLoading ? (
                        <span className="text-xs text-term-muted">Carregando...</span>
                      ) : urls?.[i] ? (
                        <a href={urls[i]!} target="_blank" rel="noopener noreferrer" className="size-full">
                          <img
                            src={urls[i]! || "/placeholder.svg"}
                            alt={`${f.label} do documento de ${row.full_name || row.email}`}
                            className="size-full object-contain"
                          />
                        </a>
                      ) : (
                        <span className="text-xs text-short">Não foi possível carregar</span>
                      )}
                    </div>
                  </figure>
                ))}
              </div>

              {row.review_notes && group === "rejected" && (
                <p className="mt-4 rounded-lg border border-short/30 bg-short/10 px-3 py-2 text-xs text-short">
                  Motivo da recusa: {row.review_notes}
                </p>
              )}

              {rejecting && (
                <div className="mt-4 flex flex-col gap-2">
                  <span className="text-xs font-medium text-term-text">Motivo da recusa (o cliente vai ver)</span>
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_REASONS.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => setReason(q)}
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                          reason === q
                            ? "border-short bg-short/15 text-short"
                            : "border-term-line text-term-muted hover:text-term-text",
                        )}
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                  <label htmlFor="kyc-reason" className="sr-only">
                    Motivo da recusa
                  </label>
                  <textarea
                    id="kyc-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    maxLength={300}
                    rows={2}
                    autoFocus
                    placeholder="Ou escreva o motivo"
                    className={cn(inputCls, "h-auto py-2 font-sans")}
                  />
                </div>
              )}
            </div>

            <footer className="flex flex-col gap-2 border-t border-term-line px-5 py-4">
              {remaining > 0 && <span className="text-[11px] text-term-muted">{`Mais ${remaining} pendente${remaining === 1 ? "" : "s"} na fila`}</span>}
              {rejecting ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setRejecting(false)}
                    className="h-10 flex-1 rounded-md bg-term-line text-sm font-medium text-term-text hover:bg-term-line/70"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={busy || !reason.trim()}
                    onClick={() => onReject(row, reason.trim())}
                    className="h-10 flex-1 rounded-md bg-short text-sm font-semibold text-term-bg hover:bg-short/90 disabled:opacity-50"
                  >
                    Confirmar recusa
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={busy || group === "rejected"}
                    onClick={() => setRejecting(true)}
                    className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-md bg-short/15 text-sm font-semibold text-short hover:bg-short/25 disabled:opacity-50"
                  >
                    <X className="size-4" aria-hidden /> Recusar
                  </button>
                  <button
                    type="button"
                    disabled={busy || group === "approved"}
                    onClick={() => onApprove(row)}
                    className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-md bg-long text-sm font-semibold text-term-bg hover:bg-long/90 disabled:opacity-50"
                  >
                    <Check className="size-4" aria-hidden /> {busy ? "Salvando..." : "Aprovar"}
                  </button>
                </div>
              )}
            </footer>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
