import { ChevronRight, ShieldCheck } from "lucide-react"
import { SUPPORT_STATUS_LABEL, categoryLabel, formatSupportTime, type SupportTicket } from "@/lib/support/constants"
import { cn } from "@/lib/utils"
import { AgentAvatar } from "./chat-header"

interface SupportWelcomeProps {
  tickets: SupportTicket[]
  onStart: () => void
  onOpen: (id: string) => void
}

export function SupportWelcome({ tickets, onStart, onOpen }: SupportWelcomeProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="m-auto flex w-full max-w-sm flex-col items-center gap-4 px-6 py-10 text-center">
        <AgentAvatar size="lg" labelled />
        <div className="mt-2 flex flex-col gap-2">
          <h2 className="text-balance text-xl font-semibold">Como podemos ajudar?</h2>
          <p className="text-pretty text-sm leading-relaxed text-term-muted">
            Conte o que está acontecendo e um atendente responde por aqui, em tempo real.
          </p>
        </div>
        <button
          type="button"
          onClick={onStart}
          className="mt-2 w-full rounded-xl bg-support px-4 py-3 text-sm font-semibold text-support-foreground transition-opacity hover:opacity-90"
        >
          Iniciar atendimento
        </button>
        <p className="flex items-center gap-1.5 text-xs text-term-muted">
          <ShieldCheck className="size-3.5" aria-hidden="true" />
          Conversa privada entre você e nossa equipe
        </p>

        {tickets.length ? (
          <section className="mt-6 flex w-full flex-col gap-2 text-left" aria-labelledby="past-tickets">
            <h3 id="past-tickets" className="px-1 text-xs font-medium uppercase tracking-wide text-term-muted">
              Seus atendimentos
            </h3>
            <ul className="flex flex-col gap-2">
              {tickets.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(t.id)}
                    className="flex w-full items-center gap-3 rounded-xl border border-term-line bg-term-panel px-3 py-2.5 text-left transition-colors hover:border-support/60"
                  >
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex items-center gap-2 text-sm font-medium">
                        <span className="font-mono text-xs text-support">#{t.ticket_number}</span>
                        <span className="truncate">{categoryLabel(t.category)}</span>
                      </span>
                      <span className="truncate text-xs text-term-muted">
                        {SUPPORT_STATUS_LABEL[t.status]} · {formatSupportTime(t.last_message_at)}
                      </span>
                    </span>
                    {t.unread_user ? <span className="size-2 rounded-full bg-support" aria-label="Nova resposta" /> : null}
                    <ChevronRight
                      className={cn("size-4 shrink-0 text-term-muted")}
                      aria-hidden="true"
                    />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  )
}
