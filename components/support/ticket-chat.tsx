"use client"

import { useEffect, useRef } from "react"
import useSWR from "swr"
import { ChevronLeft, Loader2 } from "lucide-react"
import {
  SUPPORT_STATUS_LABEL,
  categoryLabel,
  type SupportMessage,
  type SupportTicket,
} from "@/lib/support/constants"
import { MessageBubble } from "./message-bubble"
import { MessageComposer } from "./message-composer"
import { StatusBadge } from "./status-badge"
import { postSupport, supportFetcher } from "./support-fetcher"

interface TicketChatProps {
  id: string
  onBack: () => void
  onChanged: () => void
}

export function TicketChat({ id, onBack, onChanged }: TicketChatProps) {
  const url = `/api/support/tickets/${id}`
  const { data, error, mutate } = useSWR<{ ticket: SupportTicket; messages: SupportMessage[] }>(url, supportFetcher, {
    refreshInterval: 5000,
  })
  const endRef = useRef<HTMLDivElement>(null)
  const count = data?.messages.length ?? 0

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" })
  }, [count])

  const ticket = data?.ticket
  const closed = ticket?.status === "closed"

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-term-line px-4">
        <button
          type="button"
          onClick={onBack}
          aria-label="Voltar aos atendimentos"
          className="-ml-2 flex size-8 items-center justify-center rounded-full text-term-muted hover:bg-term-line hover:text-term-text md:hidden"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <h2 className="truncate text-sm font-semibold">{ticket ? categoryLabel(ticket.category) : "Atendimento"}</h2>
          {ticket ? <StatusBadge status={ticket.status} label={SUPPORT_STATUS_LABEL[ticket.status]} /> : null}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-5" aria-live="polite">
        {error ? (
          <p className="text-center text-sm text-term-down">{error.message}</p>
        ) : !data ? (
          <div className="flex flex-1 items-center justify-center text-term-muted">
            <Loader2 className="size-5 animate-spin" aria-label="Carregando" />
          </div>
        ) : (
          data.messages.map((m) => (
            <MessageBubble
              key={m.id}
              mine={m.sender === "user"}
              author={m.sender === "admin" ? "Suporte Kryptobit" : undefined}
              body={m.body}
              time={m.created_at}
            />
          ))
        )}
        <div ref={endRef} />
      </div>

      <div className="shrink-0 border-t border-term-line p-3">
        {closed ? (
          <p className="py-2 text-center text-sm text-term-muted">
            Este atendimento foi encerrado. Abra um novo se precisar de ajuda.
          </p>
        ) : (
          <MessageComposer
            placeholder="Escreva uma mensagem..."
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
