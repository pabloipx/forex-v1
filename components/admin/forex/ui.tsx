import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function Panel({ title, action, children, className }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("overflow-hidden rounded-xl border border-term-line bg-term-panel", className)}>
      {(title || action) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-term-line px-4 py-3">
          {title && <h2 className="text-sm font-semibold text-term-text">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

export function Stat({ label, value, tone, hint }: { label: string; value: string; tone?: "up" | "down" | "accent"; hint?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-xl border border-term-line bg-term-panel px-3 py-3 md:px-4">
      <span className="truncate text-xs text-term-muted">{label}</span>
      <span
        className={cn(
          "truncate font-mono text-base font-semibold tabular-nums text-term-text md:text-lg",
          tone === "up" && "text-long",
          tone === "down" && "text-short",
          tone === "accent" && "text-primary",
        )}
      >
        {value}
      </span>
      {hint && <span className="text-[11px] text-term-muted">{hint}</span>}
    </div>
  )
}

export function DataTable({ head, children, empty }: { head: string[]; children: ReactNode; empty?: string | false }) {
  return (
    <div className="overscroll-x-contain overflow-x-auto [-webkit-overflow-scrolling:touch]">
      <table
        className={cn(
          "w-full min-w-max text-left text-xs",
          "[&_tbody_tr]:border-b [&_tbody_tr]:border-term-line/60 [&_tbody_tr:last-child]:border-0 [&_tbody_tr:hover]:bg-term-line/20",
          "max-md:[&_tbody_td:first-child]:sticky max-md:[&_tbody_td:first-child]:left-0 max-md:[&_tbody_td:first-child]:z-[1] max-md:[&_tbody_td:first-child]:bg-term-panel",
          "max-md:[&_th:first-child]:sticky max-md:[&_th:first-child]:left-0 max-md:[&_th:first-child]:z-[1] max-md:[&_th:first-child]:bg-term-panel",
        )}
      >
        <thead>
          <tr className="border-b border-term-line text-term-muted">
            {head.map((h) => (
              <th key={h} scope="col" className="whitespace-nowrap px-3 py-2.5 text-[11px] font-medium uppercase tracking-wide md:px-4">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="text-term-text">{children}</tbody>
      </table>
      {empty && <p className="px-4 py-10 text-center text-xs text-term-muted">{empty}</p>}
    </div>
  )
}

export const td = "whitespace-nowrap px-3 py-3 font-mono tabular-nums md:px-4 md:py-2.5"

export function Badge({ children, tone = "muted" }: { children: ReactNode; tone?: "up" | "down" | "accent" | "muted" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 font-sans text-[11px] font-medium",
        tone === "up" && "bg-long/15 text-long",
        tone === "down" && "bg-short/15 text-short",
        tone === "accent" && "bg-primary/15 text-primary",
        tone === "muted" && "bg-term-line text-term-muted",
      )}
    >
      {children}
    </span>
  )
}

export function SmallButton({
  children,
  onClick,
  tone = "muted",
  disabled,
  type = "button",
}: {
  children: ReactNode
  onClick?: () => void
  tone?: "up" | "down" | "accent" | "muted"
  disabled?: boolean
  type?: "button" | "submit"
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-md px-3 py-2 font-sans text-xs font-medium transition-colors disabled:opacity-50 md:px-2.5 md:py-1",
        tone === "up" && "bg-long text-term-bg hover:bg-long/90",
        tone === "down" && "bg-short/15 text-short hover:bg-short/25",
        tone === "accent" && "bg-primary text-primary-foreground hover:bg-primary/90",
        tone === "muted" && "bg-term-line text-term-text hover:bg-term-line/70",
      )}
    >
      {children}
    </button>
  )
}

export const inputCls =
  "h-10 w-full rounded-md border border-term-line bg-term-bg px-3 font-mono text-base text-term-text outline-none transition-colors focus:border-primary md:h-9 md:text-sm"

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null
  return <p className="px-4 py-3 text-xs text-short">{(error as Error).message}</p>
}
