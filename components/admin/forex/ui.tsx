import type { ReactNode } from "react"
import { cn } from "@/lib/utils"

export function Panel({ title, action, children, className }: { title?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-lg border border-term-line bg-term-panel", className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-term-line px-4 py-3">
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
    <div className="flex flex-col gap-1 rounded-lg border border-term-line bg-term-panel px-4 py-3">
      <span className="text-xs text-term-muted">{label}</span>
      <span
        className={cn(
          "font-mono text-lg font-semibold tabular-nums text-term-text",
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
    <div className="overflow-x-auto">
      <table className="w-full min-w-max text-left text-xs">
        <thead>
          <tr className="border-b border-term-line text-term-muted">
            {head.map((h) => (
              <th key={h} scope="col" className="whitespace-nowrap px-4 py-2 font-normal">
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

export const td = "whitespace-nowrap px-4 py-2.5 font-mono tabular-nums"

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
        "rounded px-2.5 py-1 font-sans text-xs font-medium transition-colors disabled:opacity-50",
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
  "h-9 w-full rounded-md border border-term-line bg-term-bg px-3 font-mono text-sm text-term-text outline-none focus:border-primary"

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null
  return <p className="px-4 py-3 text-xs text-short">{(error as Error).message}</p>
}
