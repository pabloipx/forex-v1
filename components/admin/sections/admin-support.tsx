"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import useSWR from "swr"
import { CheckCircle2, Inbox, Loader2, Mail, Phone, RefreshCw, RotateCcw, Search } from "lucide-react"
import {
  SUPPORT_CATEGORIES,
  SUPPORT_STATUS_LABEL,
  categoryLabel,
  formatSupportTime,
  type SupportMessage,
  type SupportStatus,
  type SupportTicket,
} from "@/lib/support/constants"
import { MessageBubble } from "@/components/support/message-bubble"
import { MessageComposer } from "@/components/support/message-composer"
import { StatusBadge } from "@/components/support/status-badge"
import { postSupport, supportFetcher } from "@/components/support/support-fetcher"
import { cn } from "@/lib/utils"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

type AdminTicket = SupportTicket & { user_id: string; user_name: string; user_email: string }
type ListResponse = {
  summary: { open: number; answered: number; closed: number; unread: number }
  tickets: AdminTicket[]
}
type DetailResponse = {
  ticket: AdminTicket
  user: { email: string; full_name: string; phone: string }
  messages: SupportMessage[]
}

const FILTERS: { id: SupportStatus | "all"; label: string }[] = [
  { id: "open", label: "Aguardando" },
  { id: "answered", label: "Respondidos" },
  { id: "closed", label: "Encerrados" },
  { id: "all", label: "Todos" },
]

export function AdminSupport() {
  const [filter, setFilter] = useState<SupportStatus | "all">("open")
  const [category, setCategory] = useState<string>("all")
  const [query, setQuery] = useState("")
  const [activeId, setActiveId] = useState<string | null>(null)

  const listUrl = filter === "all" ? "/api/admin/support" : `/api/admin/support?status=${filter}`
  const { data, isLoading, isValidating, mutate } = useSWR<ListResponse>(listUrl, supportFetcher, {
    refreshInterval: 10000,
  })

  const tickets = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (data?.tickets ?? []).filter(
      (t) =>
        (category === "all" || t.category === category) &&
        (!q || t.subject.toLowerCase().includes(q) || t.user_email.toLowerCase().includes(q) || t.user_name.toLowerCase().includes(q)),
    )
  }, [data, category, query])

  const summary = data?.summary

  return (
    <div className="term-dark flex flex-col gap-4 font-sans text-term-text">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Suporte</h2>
          <p className="text-sm text-gray-400">Atendimentos abertos pelos leads</p>
        </div>
        <button
          type="button"
          onClick={() => mutate()}
          className="flex items-center gap-2 rounded-lg bg-[#1A1F2E] px-4 py-2 text-sm text-gray-300 hover:bg-[#232A3A]"
        >
          <RefreshCw className={cn("size-4", isValidating && "animate-spin")} aria-hidden="true" />
          Atualizar
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryCard label="Aguardando resposta" value={summary?.open} tone="text-support" />
        <SummaryCard label="Não lidos" value={summary?.unread} tone="text-blue-500" />
        <SummaryCard label="Respondidos" value={summary?.answered} tone="text-term-up" />
        <SummaryCard label="Encerrados" value={summary?.closed} tone="text-gray-400" />
      </div>

      <div className="flex h-[calc(100dvh-16rem)] min-h-[520px] overflow-hidden rounded-xl border border-[#1E2633] bg-[#131A24]">
        <aside
          className={cn(
            "min-h-0 w-full flex-col border-[#1E2633] lg:flex lg:w-96 lg:shrink-0 lg:border-r",
            activeId ? "hidden" : "flex",
          )}
          aria-label="Tickets"
        >
          <div className="flex flex-col gap-3 border-b border-[#1E2633] p-3">
            <div className="flex gap-1 rounded-lg bg-[#0F151E] p-1" role="tablist">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  aria-selected={filter === f.id}
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    "flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
                    filter === f.id ? "bg-blue-500 text-white" : "text-gray-400 hover:text-gray-200",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <label className="relative flex-1">
                <span className="sr-only">Buscar tickets</span>
                <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-gray-500" aria-hidden="true" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar lead ou assunto"
                  className="w-full rounded-lg border border-[#1E2633] bg-[#0F151E] py-2 pl-8 pr-3 text-sm text-white outline-none placeholder:text-gray-500 focus:border-blue-500/60"
                />
              </label>
              <label>
                <span className="sr-only">Filtrar por tipo</span>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="h-full rounded-lg border border-[#1E2633] bg-[#0F151E] px-2 text-sm text-gray-300 outline-none"
                >
                  <option value="all">Todos os tipos</option>
                  {SUPPORT_CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <ul className="min-h-0 flex-1 overflow-y-auto">
            {isLoading ? (
              <li className="flex justify-center py-10 text-gray-500">
                <Loader2 className="size-5 animate-spin" aria-label="Carregando" />
              </li>
            ) : tickets.length === 0 ? (
              <li className="px-4 py-10 text-center text-sm text-gray-500">Nenhum ticket aqui.</li>
            ) : (
              tickets.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setActiveId(t.id)}
                    aria-current={activeId === t.id ? "true" : undefined}
                    className={cn(
                      "flex w-full gap-3 border-b border-[#1E2633] px-4 py-3 text-left transition-colors hover:bg-[#1A1F2E]",
                      activeId === t.id && "bg-[#1A1F2E]",
                    )}
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-sm font-semibold uppercase text-blue-500">
                      {(t.user_name || t.user_email || "?").charAt(0)}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex items-center justify-between gap-2">
                        <span className={cn("truncate text-sm", t.unread_admin ? "font-semibold text-white" : "text-gray-200")}>
                          {t.user_name || t.user_email || "Lead"}
                        </span>
                        <time className="shrink-0 text-[11px] text-gray-500">{formatSupportTime(t.last_message_at)}</time>
                      </span>
                      <span className="truncate text-xs text-gray-400"><span className="font-mono text-support">#{t.ticket_number}</span> · {t.subject}</span>
                      <span className="mt-1 flex items-center gap-2">
                        <span className="rounded bg-[#0F151E] px-1.5 py-0.5 text-[11px] text-gray-400">
                          {categoryLabel(t.category)}
                        </span>
                        <StatusBadge status={t.status} label={SUPPORT_STATUS_LABEL[t.status]} />
                        {t.unread_admin ? (
                          <span className="ml-auto size-2 rounded-full bg-blue-500" aria-label="Não lido" />
                        ) : null}
                      </span>
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </aside>

        <section className={cn("min-h-0 flex-1 flex-col lg:flex", activeId ? "flex" : "hidden")}>
          {activeId ? (
            <AdminTicketChat key={activeId} id={activeId} onBack={() => setActiveId(null)} onChanged={() => mutate()} />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
              <Inbox className="size-8 text-gray-600" aria-hidden="true" />
              <p className="text-sm text-gray-400">Selecione um ticket para responder</p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function SummaryCard({ label, value, tone }: { label: string; value?: number; tone: string }) {
  return (
    <div className="rounded-xl border border-[#1E2633] bg-[#131A24] p-4">
      <p className="text-xs text-gray-400">{label}</p>
      <p className={cn("mt-1 text-2xl font-bold tabular-nums", tone)}>{value ?? "–"}</p>
    </div>
  )
}

function AdminTicketChat({ id, onBack, onChanged }: { id: string; onBack: () => void; onChanged: () => void }) {
  const url = `/api/admin/support/${id}`
  const { data, error, mutate } = useSWR<DetailResponse>(url, supportFetcher, { refreshInterval: 5000 })
  const [updating, setUpdating] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const count = data?.messages.length ?? 0

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" })
  }, [count])

  useEffect(() => {
    if (data) onChanged()
    // Atualiza a lista uma vez quando o ticket é aberto (marca como lido).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Boolean(data)])

  const ticket = data?.ticket
  const closed = ticket?.status === "closed"

  const [actionError, setActionError] = useState<string | null>(null)

  async function setStatus(status: "open" | "closed") {
    setUpdating(true)
    setActionError(null)
    try {
      await postSupport(url, { status }, "PATCH")
      await mutate()
      onChanged()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Não foi possível atualizar o ticket")
    } finally {
      setUpdating(false)
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-[#1E2633] px-4 py-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg bg-[#1A1F2E] px-2.5 py-1.5 text-xs text-gray-300 lg:hidden"
        >
          Voltar
        </button>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-semibold text-white">
            {data?.user.full_name || data?.user.email || "Carregando..."}
          </span>
          {data ? (
            <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-400">
              {data.user.email ? (
                <span className="flex items-center gap-1">
                  <Mail className="size-3" aria-hidden="true" />
                  {data.user.email}
                </span>
              ) : null}
              {data.user.phone ? (
                <span className="flex items-center gap-1">
                  <Phone className="size-3" aria-hidden="true" />
                  {data.user.phone}
                </span>
              ) : null}
            </span>
          ) : null}
        </div>
        {ticket ? (
          <div className="flex items-center gap-2">
            <span className="rounded bg-[#0F151E] px-2 py-1 font-mono text-xs text-support">#{ticket.ticket_number}</span>
            <span className="rounded bg-[#0F151E] px-2 py-1 text-xs text-gray-300">{categoryLabel(ticket.category)}</span>
            <StatusBadge status={ticket.status} label={SUPPORT_STATUS_LABEL[ticket.status]} />
            {closed ? (
              <button
                type="button"
                disabled={updating}
                onClick={() => setStatus("open")}
                className="flex items-center gap-1.5 rounded-lg bg-[#1A1F2E] px-3 py-1.5 text-xs font-medium text-gray-200 hover:bg-[#232A3A] disabled:opacity-50"
              >
                <RotateCcw className="size-3.5" aria-hidden="true" />
                Reabrir
              </button>
            ) : (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button
                    type="button"
                    disabled={updating}
                    className="flex items-center gap-1.5 rounded-lg bg-support px-3 py-1.5 text-xs font-semibold text-support-foreground hover:bg-support/90 disabled:opacity-50"
                  >
                    {updating ? (
                      <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <CheckCircle2 className="size-3.5" aria-hidden="true" />
                    )}
                    Encerrar atendimento
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent className="border-[#1E2633] bg-[#131A24] text-white">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Encerrar atendimento #{ticket.ticket_number}?</AlertDialogTitle>
                    <AlertDialogDescription className="text-gray-400">
                      O chat será fechado para {data?.user.full_name || data?.user.email || "o lead"} e ele receberá
                      uma mensagem de encerramento. Se precisar, ele poderá abrir um novo ticket.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="border-[#1E2633] bg-[#1A1F2E] text-gray-200 hover:bg-[#232A3A] hover:text-white">
                      Cancelar
                    </AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => setStatus("closed")}
                      className="bg-support text-support-foreground hover:bg-support/90"
                    >
                      Encerrar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-[#0F151E] px-4 py-5" aria-live="polite">
        {error ? (
          <p className="text-center text-sm text-term-down">{error.message}</p>
        ) : !data ? (
          <div className="flex flex-1 items-center justify-center text-gray-500">
            <Loader2 className="size-5 animate-spin" aria-label="Carregando" />
          </div>
        ) : (
          <>
            <p className="text-center text-[11px] text-gray-500">
              Ticket aberto em {new Date(data.ticket.created_at).toLocaleString("pt-BR")}
            </p>
            {data.messages.map((m) => (
              <MessageBubble
                key={m.id}
                mine={m.sender === "admin"}
                author={m.sender === "user" ? data.user.full_name || "Lead" : "Você"}
                body={m.body}
                time={m.created_at}
              />
            ))}
          </>
        )}
        <div ref={endRef} />
      </div>

      <div className="flex shrink-0 flex-col gap-2 border-t border-[#1E2633] p-3">
        {actionError ? (
          <p role="alert" className="text-center text-xs text-red-400">
            {actionError}
          </p>
        ) : null}
        {closed ? (
          <p className="py-2 text-center text-sm text-gray-500">
            Atendimento encerrado. O lead pode abrir um novo ticket se precisar.
          </p>
        ) : (
          <MessageComposer
            placeholder="Responder ao lead... (Enter envia, Shift+Enter quebra linha)"
            disabled={!data}
            onSend={async (message) => {
              await postSupport(url, { message })
              await mutate()
              onChanged()
            }}
          />
        )}
      </div>
    </div>
  )
}
