"use client"

import { Fragment, useEffect, useRef } from "react"
import useSWR from "swr"
import { Loader2 } from "lucide-react"
import {
  findCategory,
  formatDayLabel,
  type SupportMessage,
  type SupportStatus,
  type SupportTicket,
} from "@/lib/support/constants"
import { ChatHeader } from "./chat-header"
import { ChatBubble, DaySeparator } from "./chat-bubble"
import { ChatComposer } from "./chat-composer"
import { ScriptChoice, ScriptIntro } from "./chat-script"
import { postSupport, supportFetcher } from "./support-fetcher"

const HEADER_STATUS: Record<SupportStatus, string> = {
  open: "Aguardando atendente",
  answered: "Em atendimento",
  closed: "Atendimento encerrado",
}

interface TicketChatProps {
  id: string
  onNew: () => void
  onChanged: () => void
}

export function TicketChat({ id, onNew, onChanged }: TicketChatProps) {
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
  const introDay = ticket ? formatDayLabel(ticket.created_at) : null

  return (
    <>
      <ChatHeader
        status={ticket ? HEADER_STATUS[ticket.status] : "Carregando..."}
        subtitle={ticket ? `Suporte oficial · ${findCategory(ticket.category).short}` : undefined}
        ticketNumber={ticket?.ticket_number}
        live={!closed}
      />

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 py-4 sm:px-4" aria-live="polite">
        {error ? (
          <p className="m-auto text-sm text-term-down">{error.message}</p>
        ) : !data || !ticket ? (
          <div className="flex flex-1 items-center justify-center text-term-muted">
            <Loader2 className="size-5 animate-spin" aria-label="Carregando" />
          </div>
        ) : (
          <>
            <DaySeparator label={introDay ?? "Hoje"} />
            <ScriptIntro time={ticket.created_at} />
            <ScriptChoice category={ticket.category} time={ticket.created_at} />
            {data.messages.map((m, i) => {
              const day = formatDayLabel(m.created_at)
              const prevDay = i === 0 ? introDay : formatDayLabel(data.messages[i - 1].created_at)
              return (
                <Fragment key={m.id}>
                  {day !== prevDay ? <DaySeparator label={day} /> : null}
                  <ChatBubble from={m.sender === "user" ? "user" : "agent"} time={m.created_at}>
                    {m.body}
                  </ChatBubble>
                </Fragment>
              )
            })}
            {ticket.status === "open" && data.messages.every((m) => m.sender === "user") ? (
              <p className="py-2 text-center text-xs text-term-muted">
                Recebemos sua mensagem. Um atendente vai responder em instantes.
              </p>
            ) : null}
          </>
        )}
        <div ref={endRef} />
      </div>

      {closed ? (
        <div className="flex shrink-0 flex-col items-center gap-2 border-t border-term-line px-4 py-3 sm:flex-row sm:justify-between">
          <p className="text-pretty text-sm text-term-muted">
            Este atendimento foi encerrado. Precisa de mais ajuda? Abra um novo.
          </p>
          <button
            type="button"
            onClick={onNew}
            className="rounded-xl bg-support px-4 py-2 text-sm font-semibold text-support-foreground transition-opacity hover:opacity-90"
          >
            Iniciar novo atendimento
          </button>
        </div>
      ) : (
        <ChatComposer
          placeholder="Escreva uma mensagem..."
          disabled={!data}
          onSend={async (message) => {
            await postSupport(url, { message })
            await mutate()
            onChanged()
          }}
        />
      )}
    </>
  )
}
