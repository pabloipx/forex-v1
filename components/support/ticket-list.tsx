"use client"

import { Loader2 } from "lucide-react"
import { SUPPORT_STATUS_LABEL, categoryLabel, formatSupportTime, type SupportTicket } from "@/lib/support/constants"
import { cn } from "@/lib/utils"
import { StatusBadge } from "./status-badge"

interface TicketListProps {
  tickets: SupportTicket[]
  loading: boolean
  activeId: string | null
  onSelect: (id: string) => void
}

export function TicketList({ tickets, loading, activeId, onSelect }: TicketListProps) {
  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center py-10 text-term-muted">
        <Loader2 className="size-5 animate-spin" aria-label="Carregando" />
      </div>
    )
  }
  if (!tickets.length) {
    return <p className="px-4 py-8 text-center text-sm text-term-muted">Nenhum atendimento ainda.</p>
  }

  return (
    <ul className="min-h-0 flex-1 overflow-y-auto">
      {tickets.map((t) => (
        <li key={t.id}>
          <button
            type="button"
            onClick={() => onSelect(t.id)}
            aria-current={activeId === t.id ? "true" : undefined}
            className={cn(
              "flex w-full flex-col gap-1 border-b border-term-line px-4 py-3 text-left transition-colors hover:bg-term-panel",
              activeId === t.id && "bg-term-panel",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-term-muted">{categoryLabel(t.category)}</span>
              <time className="text-[11px] text-term-muted">{formatSupportTime(t.last_message_at)}</time>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn("flex-1 truncate text-sm", t.unread_user ? "font-semibold" : "text-term-text")}>
                {t.subject}
              </span>
              {t.unread_user ? <span className="size-2 shrink-0 rounded-full bg-primary" aria-label="Nova resposta" /> : null}
            </div>
            <StatusBadge status={t.status} label={SUPPORT_STATUS_LABEL[t.status]} />
          </button>
        </li>
      ))}
    </ul>
  )
}
