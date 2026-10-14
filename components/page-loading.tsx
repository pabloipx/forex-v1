import { Loader2 } from "lucide-react"

export function PageLoading({ label }: { label: string }) {
  return (
    <main className="flex min-h-dvh flex-col bg-background">
      <div className="flex h-14 items-center gap-3 border-b border-border px-4">
        <div className="h-5 w-5 animate-pulse rounded bg-muted" />
        <div className="h-4 w-32 animate-pulse rounded bg-muted" />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground" role="status">
        <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
        <span className="text-sm">{label}</span>
      </div>
    </main>
  )
}
