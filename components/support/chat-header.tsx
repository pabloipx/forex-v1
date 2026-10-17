import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, BadgeCheck } from "lucide-react"
import { SUPPORT_AGENT } from "@/lib/support/constants"
import { cn } from "@/lib/utils"

const AVATAR_SIZES = {
  sm: { box: "size-7", dot: "size-2", px: "28px" },
  md: { box: "size-11", dot: "size-2.5", px: "44px" },
  lg: { box: "size-24", dot: "size-3.5", px: "96px" },
} as const

interface AgentAvatarProps {
  size?: keyof typeof AVATAR_SIZES
  online?: boolean
  labelled?: boolean
}

export function AgentAvatar({ size = "md", online = true, labelled = false }: AgentAvatarProps) {
  const s = AVATAR_SIZES[size]
  return (
    <span className={cn("relative block shrink-0", s.box)}>
      <Image
        src={SUPPORT_AGENT.avatar || "/placeholder.svg"}
        alt={labelled ? SUPPORT_AGENT.name : ""}
        fill
        sizes={s.px}
        className={cn("rounded-full object-cover", size !== "sm" && "ring-2 ring-support ring-offset-2 ring-offset-term-bg")}
      />
      {online ? (
        <span className={cn("absolute bottom-0 right-0 rounded-full bg-term-up ring-2 ring-term-bg", s.dot)} />
      ) : null}
    </span>
  )
}

interface ChatHeaderProps {
  status: string
  subtitle?: string
  ticketNumber?: number
  live?: boolean
}

export function ChatHeader({ status, subtitle, ticketNumber, live = true }: ChatHeaderProps) {
  return (
    <header className="shrink-0 border-b border-term-line bg-gradient-to-r from-support/15 via-term-panel/70 to-term-panel/40">
      <div className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
        <Link
          href="/futures"
          aria-label="Voltar"
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-term-muted transition-colors hover:bg-term-line hover:text-term-text"
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
        </Link>
        <AgentAvatar size="md" />
        <div className="flex min-w-0 flex-1 flex-col">
          <h1 className="flex items-center gap-1.5 text-base font-semibold leading-tight">
            <span className="truncate">{SUPPORT_AGENT.name}</span>
            <BadgeCheck className="size-4 shrink-0 fill-support text-term-bg" aria-label="Perfil verificado" />
          </h1>
          <p className="flex items-center gap-1.5 text-xs text-term-muted">
            <span className={cn("size-1.5 rounded-full", live ? "bg-term-up" : "bg-term-muted")} aria-hidden="true" />
            {status}
          </p>
          {subtitle ? <p className="truncate text-[11px] text-term-muted">{subtitle}</p> : null}
        </div>
        {ticketNumber ? (
          <span className="shrink-0 rounded-full border border-support/50 bg-support/10 px-2.5 py-1 font-mono text-xs font-semibold text-support">
            #{ticketNumber}
          </span>
        ) : null}
      </div>
    </header>
  )
}
