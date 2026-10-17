"use client"

import { useState } from "react"
import { ArrowDownToLine, ArrowUpFromLine, ChevronLeft, CircleHelp, CandlestickChart, UserRound } from "lucide-react"
import { SUPPORT_CATEGORIES, type SupportCategory } from "@/lib/support/constants"
import { MessageBubble } from "./message-bubble"
import { MessageComposer } from "./message-composer"
import { postSupport } from "./support-fetcher"

const ICONS: Record<SupportCategory, typeof CircleHelp> = {
  deposito: ArrowDownToLine,
  saque: ArrowUpFromLine,
  conta: UserRound,
  operacoes: CandlestickChart,
  outro: CircleHelp,
}

interface NewTicketFlowProps {
  onBack?: () => void
  onCreated: (id: string) => void | Promise<void>
}

export function NewTicketFlow({ onBack, onCreated }: NewTicketFlowProps) {
  const [category, setCategory] = useState<SupportCategory | null>(null)
  const selected = SUPPORT_CATEGORIES.find((c) => c.id === category)

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-12 shrink-0 items-center gap-2 border-b border-term-line px-4">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            aria-label="Voltar aos atendimentos"
            className="-ml-2 flex size-8 items-center justify-center rounded-full text-term-muted hover:bg-term-line hover:text-term-text md:hidden"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
        ) : null}
        <h2 className="text-sm font-semibold">Novo atendimento</h2>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-5">
        <MessageBubble
          mine={false}
          author="Suporte Kryptobit"
          body="Olá! Para te ajudar mais rápido, escolha o tipo de problema:"
        />

        <div className="flex flex-col gap-2 pl-9" role="radiogroup" aria-label="Tipo de problema">
          {SUPPORT_CATEGORIES.map((c) => {
            const Icon = ICONS[c.id]
            const active = category === c.id
            return (
              <button
                key={c.id}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={category !== null && !active}
                onClick={() => setCategory(c.id)}
                className={
                  "flex max-w-md items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors disabled:opacity-40 " +
                  (active
                    ? "border-primary bg-primary/10"
                    : "border-term-line bg-term-panel hover:border-primary/50")
                }
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <Icon className="size-4" aria-hidden="true" />
                </span>
                <span className="flex flex-col">
                  <span className="text-sm font-medium">{c.label}</span>
                  <span className="text-xs text-term-muted">{c.description}</span>
                </span>
              </button>
            )
          })}
          {category ? (
            <button
              type="button"
              onClick={() => setCategory(null)}
              className="w-fit px-1 text-xs font-medium text-primary hover:underline"
            >
              Trocar tipo
            </button>
          ) : null}
        </div>

        {selected ? (
          <>
            <MessageBubble mine body={selected.label} />
            <MessageBubble
              mine={false}
              author="Suporte Kryptobit"
              body="Certo! Agora descreva seu problema com o máximo de detalhes (valores, datas, ID da transação)."
            />
          </>
        ) : null}
      </div>

      {selected ? (
        <div className="shrink-0 border-t border-term-line p-3">
          <MessageComposer
            autoFocus
            rows={2}
            placeholder="Descreva o que aconteceu..."
            onSend={async (message) => {
              const { id } = await postSupport("/api/support/tickets", { category: selected.id, message })
              await onCreated(id)
            }}
          />
        </div>
      ) : null}
    </div>
  )
}
