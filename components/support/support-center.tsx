"use client"

import { useState } from "react"
import useSWR from "swr"
import { MessageSquarePlus } from "lucide-react"
import type { SupportTicket } from "@/lib/support/constants"
import { supportFetcher } from "./support-fetcher"
import { TicketList } from "./ticket-list"
import { NewTicketFlow } from "./new-ticket-flow"
import { TicketChat } from "./ticket-chat"
import { cn } from "@/lib/utils"

type View = { kind: "new" } | { kind: "ticket"; id: string } | { kind: "empty" }

export function SupportCenter() {
  const { data, isLoading, mutate } = useSWR<{ tickets: SupportTicket[] }>("/api/support/tickets", supportFetcher, {
    refreshInterval: 15000,
  })
  const tickets = data?.tickets ?? []
  const [view, setView] = useState<View | null>(null)
  const current: View = view ?? (isLoading ? { kind: "empty" } : tickets.length ? { kind: "empty" } : { kind: "new" })
  const showDetailOnMobile = view !== null || (!isLoading && tickets.length === 0)

  return (
    <main className="mx-auto flex min-h-0 w-full max-w-5xl flex-1">
      <aside
        className={cn(
          "min-h-0 w-full flex-col border-term-line md:flex md:w-80 md:shrink-0 md:border-r",
          showDetailOnMobile ? "hidden" : "flex",
        )}
        aria-label="Seus atendimentos"
      >
        <div className="flex items-center justify-between gap-2 border-b border-term-line px-4 py-3">
          <h2 className="text-sm font-semibold">Seus atendimentos</h2>
          <button
            type="button"
            onClick={() => setView({ kind: "new" })}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            <MessageSquarePlus className="size-3.5" aria-hidden="true" />
            Novo
          </button>
        </div>
        <TicketList
          tickets={tickets}
          loading={isLoading}
          activeId={current.kind === "ticket" ? current.id : null}
          onSelect={(id) => setView({ kind: "ticket", id })}
        />
      </aside>

      <section className={cn("min-h-0 flex-1 flex-col md:flex", showDetailOnMobile ? "flex" : "hidden")}>
        {current.kind === "new" ? (
          <NewTicketFlow
            onBack={tickets.length ? () => setView(null) : undefined}
            onCreated={async (id) => {
              await mutate()
              setView({ kind: "ticket", id })
            }}
          />
        ) : current.kind === "ticket" ? (
          <TicketChat key={current.id} id={current.id} onBack={() => setView(null)} onChanged={() => mutate()} />
        ) : (
          <div className="hidden flex-1 flex-col items-center justify-center gap-2 px-6 text-center md:flex">
            <p className="text-sm font-medium">Selecione um atendimento</p>
            <p className="max-w-xs text-sm leading-relaxed text-term-muted">
              Ou abra um novo para falar com nossa equipe.
            </p>
          </div>
        )}
      </section>
    </main>
  )
}
