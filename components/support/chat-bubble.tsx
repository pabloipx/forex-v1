import { CheckCheck } from "lucide-react"
import { formatClock } from "@/lib/support/constants"
import { cn } from "@/lib/utils"
import { AgentAvatar } from "./chat-header"

interface ChatBubbleProps {
  from: "agent" | "user"
  time?: string
  children: React.ReactNode
}

export function ChatBubble({ from, time, children }: ChatBubbleProps) {
  const mine = from === "user"
  return (
    <div className={cn("flex items-end gap-2", mine ? "justify-end" : "justify-start")}>
      {!mine ? <AgentAvatar size="sm" online={false} /> : null}
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed sm:max-w-[70%]",
          mine
            ? "rounded-br-md bg-support text-support-foreground"
            : "rounded-bl-md border border-term-line bg-term-panel text-term-text",
        )}
      >
        <div className="whitespace-pre-wrap break-words">{children}</div>
        {time ? (
          <div
            className={cn(
              "mt-1 flex items-center justify-end gap-1 text-[11px]",
              mine ? "text-support-foreground/80" : "text-term-muted",
            )}
          >
            <time dateTime={time}>{formatClock(time)}</time>
            {mine ? <CheckCheck className="size-3.5" aria-label="Enviada" /> : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function DaySeparator({ label }: { label: string }) {
  return (
    <div className="flex justify-center py-1">
      <span className="rounded-full border border-term-line bg-term-panel px-3 py-1 text-[11px] font-medium text-term-muted">
        {label}
      </span>
    </div>
  )
}
