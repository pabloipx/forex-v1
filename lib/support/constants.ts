export const SUPPORT_CATEGORIES = [
  { id: "saque", label: "Problemas com saques", short: "Saques" },
  { id: "deposito", label: "Problemas com depósitos", short: "Depósitos" },
  { id: "erros", label: "Plataforma travando ou apresentando erros", short: "Erros na plataforma" },
  { id: "senha", label: "Problemas com senha ou acesso à conta", short: "Senha e acesso" },
  { id: "recuperacao", label: "Recuperação de conta", short: "Recuperação de conta" },
  { id: "operacoes", label: "Problemas com operações", short: "Operações" },
  { id: "outro", label: "Outro assunto", short: "Outro assunto" },
] as const

export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number]["id"]
export type SupportStatus = "open" | "answered" | "closed"

export const SUPPORT_MESSAGE_MAX = 4000
export const SUPPORT_MAX_OPEN_TICKETS = 5

export const SUPPORT_AGENT = {
  name: "Thiago Morais",
  avatar: "/images/support/thiago-avatar.png",
}

export const SUPPORT_STATUS_LABEL: Record<SupportStatus, string> = {
  open: "Aguardando",
  answered: "Respondido",
  closed: "Encerrado",
}

export const SUPPORT_TICKET_COLUMNS =
  "id, ticket_number, category, subject, status, unread_admin, unread_user, last_message_at, created_at"

export function isSupportCategory(value: unknown): value is SupportCategory {
  return SUPPORT_CATEGORIES.some((c) => c.id === value)
}

export function findCategory(id: string) {
  return SUPPORT_CATEGORIES.find((c) => c.id === id) ?? SUPPORT_CATEGORIES[SUPPORT_CATEGORIES.length - 1]
}

export function categoryLabel(id: string) {
  return findCategory(id).short
}

export function parseMessageBody(value: unknown): string | null {
  if (typeof value !== "string") return null
  const body = value.trim()
  if (!body || body.length > SUPPORT_MESSAGE_MAX) return null
  return body
}

export interface SupportTicket {
  id: string
  ticket_number: number
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

export function formatClock(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
}

export function formatDayLabel(iso: string) {
  const date = new Date(iso)
  const today = new Date()
  const yesterday = new Date()
  yesterday.setDate(today.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return "Hoje"
  if (date.toDateString() === yesterday.toDateString()) return "Ontem"
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })
}
