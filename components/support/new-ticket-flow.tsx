"use client"

import { useEffect, useRef, useState } from "react"
import { findCategory, type SupportCategory } from "@/lib/support/constants"
import { ChatHeader } from "./chat-header"
import { DaySeparator } from "./chat-bubble"
import { CategoryOptions, DescribeHint } from "./category-options"
import { ChatComposer } from "./chat-composer"
import { ScriptChoice, ScriptIntro } from "./chat-script"
import { postSupport } from "./support-fetcher"

interface NewTicketFlowProps {
  onCreated: (id: string) => void | Promise<void>
}

export function NewTicketFlow({ onCreated }: NewTicketFlowProps) {
  const [startedAt] = useState(() => new Date().toISOString())
  const [choice, setChoice] = useState<{ id: SupportCategory; at: string } | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" })
  }, [choice])

  return (
    <>
      <ChatHeader
        status={choice ? "Aguardando atendente" : "Novo"}
        subtitle={choice ? `Suporte oficial · ${findCategory(choice.id).short}` : undefined}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-3 py-4 sm:px-4" aria-live="polite">
        <DaySeparator label="Hoje" />
        <ScriptIntro time={startedAt} />
        {choice ? (
          <>
            <ScriptChoice category={choice.id} time={choice.at} />
            <DescribeHint />
          </>
        ) : (
          <CategoryOptions onSelect={(id) => setChoice({ id, at: new Date().toISOString() })} />
        )}
        <div ref={endRef} />
      </div>
      <ChatComposer
        placeholder={choice ? "Descreva seu problema aqui..." : "Escolha um assunto acima"}
        disabled={!choice}
        highlight={!!choice}
        onSend={async (message) => {
          if (!choice) return
          const { id } = await postSupport("/api/support/tickets", { category: choice.id, message })
          await onCreated(id)
        }}
      />
    </>
  )
}
