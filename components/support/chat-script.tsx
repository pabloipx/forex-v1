import { findCategory, type SupportCategory } from "@/lib/support/constants"
import { ChatBubble } from "./chat-bubble"
import { CategoryChip } from "./category-options"

export const WELCOME_TEXT =
  "Olá! Seja bem-vindo ao suporte da nossa plataforma!\n\nPara direcionarmos seu atendimento, selecione abaixo o assunto que você precisa resolver:"

export const DESCRIBE_TEXT =
  "Perfeito! Agora descreva o seu problema com o máximo de detalhes (o que aconteceu, valor e data, se houver). Assim que você enviar, um atendente analisa e responde por aqui em tempo real."

export function ScriptIntro({ time }: { time: string }) {
  return (
    <ChatBubble from="agent" time={time}>
      {WELCOME_TEXT}
    </ChatBubble>
  )
}

export function ScriptChoice({ category, time }: { category: SupportCategory; time: string }) {
  const c = findCategory(category)
  return (
    <>
      <ChatBubble from="user" time={time}>
        <CategoryChip id={c.id} label={c.label} />
      </ChatBubble>
      <ChatBubble from="agent" time={time}>
        {DESCRIBE_TEXT}
      </ChatBubble>
    </>
  )
}
