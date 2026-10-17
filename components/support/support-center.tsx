"use client"

import { useState } from "react"
import useSWR from "swr"
import { Loader2 } from "lucide-react"
import type { SupportTicket } from "@/lib/support/constants"
import { supportFetcher } from "./support-fetcher"
import { ChatHeader } from "./chat-header"
import { SupportWelcome } from "./support-welcome"
import { NewTicketFlow } from "./new-ticket-flow"
import { TicketChat } from "./ticket-chat"

type View = { kind: "welcome" } | { kind: "new" } | { kind: "ticket"; id: string }

export function SupportCenter() {
  const { data, isLoading, mutate } = useSWR<{ tickets: SupportTicket[] }>("/api/support/tickets", supportFetcher, {
    refreshInterval: 15000,
  })
  const tickets = data?.tickets ?? []
  const [view, setView] = useState<View | null>(null)

  const activeTicket = tickets.find((t) => t.status !== "closed")
  const current: View | null =
    view ?? (isLoading ? null : activeTicket ? { kind: "ticket", id: activeTicket.id } : { kind: "welcome" })

  return (
    <main className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col md:border-x md:border-term-line">
      {current === null ? (
        <>
          <ChatHeader status="Online · responde em minutos" />
          <div className="flex flex-1 items-center justify-center text-term-muted">
            <Loader2 className="size-5 animate-spin" aria-label="Carregando" />
          </div>
        </>
      ) : current.kind === "welcome" ? (
        <>
          <ChatHeader status="Online · responde em minutos" />
          <SupportWelcome
            tickets={tickets}
            onStart={() => setView({ kind: "new" })}
            onOpen={(id) => setView({ kind: "ticket", id })}
          />
        </>
      ) : current.kind === "new" ? (
        <NewTicketFlow
          onCreated={async (id) => {
            await mutate()
            setView({ kind: "ticket", id })
          }}
        />
      ) : (
        <TicketChat
          key={current.id}
          id={current.id}
          onNew={() => setView({ kind: "new" })}
          onChanged={() => mutate()}
        />
      )}
    </main>
  )
}
