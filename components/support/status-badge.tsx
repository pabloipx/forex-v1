import type { SupportStatus } from "@/lib/support/constants"
import { cn } from "@/lib/utils"

const STYLES: Record<SupportStatus, string> = {
  open: "bg-amber-500/15 text-amber-500",
  answered: "bg-term-up/15 text-term-up",
  closed: "bg-term-line text-term-muted",
}

export function StatusBadge({ status, label }: { status: SupportStatus; label: string }) {
  return (
    <span className={cn("inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[11px] font-medium", STYLES[status])}>
      {label}
    </span>
  )
}
