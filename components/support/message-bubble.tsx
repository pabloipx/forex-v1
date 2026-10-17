import { Headset } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatSupportTime } from "@/lib/support/constants"

interface MessageBubbleProps {
  mine: boolean
  body: React.ReactNode
  time?: string
  author?: string
}

export function MessageBubble({ mine, body, time, author }: MessageBubbleProps) {
  return (
    <div className={cn("flex items-end gap-2", mine ? "justify-end" : "justify-start")}>
      {!mine ? (
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Headset className="size-3.5" aria-hidden="true" />
        </span>
      ) : null}
      <div className={cn("flex max-w-[80%] flex-col gap-1", mine ? "items-end" : "items-start")}>
        {author ? <span className="px-1 text-[11px] font-medium text-term-muted">{author}</span> : null}
        <div
          className={cn(
            "whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
            mine ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md border border-term-line bg-term-panel text-term-text",
          )}
        >
          {body}
        </div>
        {time ? <time className="px-1 text-[11px] text-term-muted">{formatSupportTime(time)}</time> : null}
      </div>
    </div>
  )
}
