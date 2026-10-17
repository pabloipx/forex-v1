export const SUPPORT_CATEGORIES = [
  { id: "deposito", label: "Depósito", description: "PIX, cripto ou valor não creditado" },
  { id: "saque", label: "Saque", description: "Pedido pendente, recusado ou atrasado" },
  { id: "conta", label: "Conta e verificação", description: "Login, KYC, dados pessoais" },
  { id: "operacoes", label: "Operações e trading", description: "Ordens, posições, gráfico" },
  { id: "outro", label: "Outro assunto", description: "Dúvidas gerais ou sugestões" },
] as const

export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number]["id"]
export type SupportStatus = "open" | "answered" | "closed"

export const SUPPORT_MESSAGE_MAX = 4000
export const SUPPORT_MAX_OPEN_TICKETS = 5

export const SUPPORT_STATUS_LABEL: Record<SupportStatus, string> = {
  open: "Aguardando",
  answered: "Respondido",
  closed: "Encerrado",
}

export function isSupportCategory(value: unknown): value is SupportCategory {
  return SUPPORT_CATEGORIES.some((c) => c.id === value)
}

export function categoryLabel(id: string) {
  return SUPPORT_CATEGORIES.find((c) => c.id === id)?.label ?? "Outro assunto"
}

export function parseMessageBody(value: unknown): string | null {
  if (typeof value !== "string") return null
  const body = value.trim()
  if (!body || body.length > SUPPORT_MESSAGE_MAX) return null
  return body
}

export interface SupportTicket {
  id: string
  category: SupportCategory
  subject: string
  status: SupportStatus
  unread_admin: boolean
  unread_user: boolean
  last_message_at: string
  created_at: string
}

export interface SupportMessage {
  id: string
  ticket_id: string
  sender: "user" | "admin"
  body: string
  created_at: string
}

export function formatSupportTime(iso: string) {
  const date = new Date(iso)
  const now = new Date()
  const sameDay = date.toDateString() === now.toDateString()
  return sameDay
    ? date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) +
        " " +
        date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
}
