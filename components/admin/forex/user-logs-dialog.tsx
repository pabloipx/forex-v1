"use client"

import { useMemo, useState } from "react"
import useSWRInfinite from "swr/infinite"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge, ErrorNote, SmallButton, inputCls } from "./ui"
import { dateTime, signedUsd } from "./use-admin"
import { cn } from "@/lib/utils"

type Kind = "order" | "position" | "deposit" | "withdrawal" | "transfer" | "adjustment" | "kyc" | "audit"

interface ActivityEvent {
  id: string
  kind: Kind
  at: string
  title: string
  detail: string | null
  status: string | null
  amount: number | null
  account: "real" | "demo" | null
}

interface ActivityPage {
  events: ActivityEvent[]
  nextCursor: string | null
}

const KINDS: { id: Kind; label: string }[] = [
  { id: "order", label: "Ordens" },
  { id: "position", label: "Posições" },
  { id: "deposit", label: "Depósitos" },
  { id: "withdrawal", label: "Saques" },
  { id: "transfer", label: "Transferências" },
  { id: "adjustment", label: "Ajustes" },
  { id: "kyc", label: "KYC" },
  { id: "audit", label: "Auditoria" },
]
const kindLabel = Object.fromEntries(KINDS.map((k) => [k.id, k.label])) as Record<Kind, string>

const statusTone = (s: string | null) => {
  if (!s) return "muted" as const
  if (["filled", "confirmed", "paid", "approved", "closed"].includes(s)) return "up" as const
  if (["rejected", "cancelled", "canceled", "liquidated", "failed"].includes(s)) return "down" as const
  return "accent" as const
}

const PAGE = 50

const fetcher = async (url: string): Promise<ActivityPage> => {
  const res = await fetch(url, { cache: "no-store" })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error ?? "Erro ao carregar logs")
  return body.data
}

export function UserActivityFeed({ userId, className }: { userId: string; className?: string }) {
  const [kinds, setKinds] = useState<Kind[]>([])
  const [text, setText] = useState("")

  const getKey = (index: number, prev: ActivityPage | null) => {
    if (prev && !prev.nextCursor) return null
    const sp = new URLSearchParams({ userId, limit: String(PAGE) })
    if (kinds.length) sp.set("kinds", kinds.join(","))
    if (index > 0 && prev?.nextCursor) sp.set("before", prev.nextCursor)
    return `/api/admin/user-activity?${sp}`
  }

  const { data, error, size, setSize, isLoading, isValidating, mutate } = useSWRInfinite(getKey, fetcher, {
    revalidateFirstPage: false,
    revalidateOnFocus: false,
  })

  const events = useMemo(() => {
    const all = (data ?? []).flatMap((p) => p.events)
    const q = text.trim().toLowerCase()
    if (!q) return all
    return all.filter((e) => `${e.title} ${e.detail ?? ""} ${e.status ?? ""}`.toLowerCase().includes(q))
  }, [data, text])

  const hasMore = !!data?.[data.length - 1]?.nextCursor
  const loadingMore = isValidating && size > (data?.length ?? 0)

  const toggle = (k: Kind) => setKinds((cur) => (cur.includes(k) ? cur.filter((x) => x !== k) : [...cur, k]))

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-4", className)}>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por tipo">
            <button
              type="button"
              aria-pressed={kinds.length === 0}
              onClick={() => setKinds([])}
              className={cn(
                "rounded border px-2 py-1 text-xs",
                kinds.length === 0 ? "border-term-accent text-term-text" : "border-term-line text-term-muted hover:text-term-text",
              )}
            >
              Tudo
            </button>
            {KINDS.map((k) => {
              const active = kinds.includes(k.id)
              return (
                <button
                  key={k.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggle(k.id)}
                  className={cn(
                    "rounded border px-2 py-1 text-xs",
                    active ? "border-term-accent text-term-text" : "border-term-line text-term-muted hover:text-term-text",
                  )}
                >
                  {k.label}
                </button>
              )
            })}
          </div>
          <div className="flex gap-2">
            <input
              type="search"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Filtrar nos resultados carregados (ativo, status, motivo...)"
              className={cn(inputCls, "flex-1 font-sans")}
              aria-label="Filtrar logs"
            />
            <SmallButton tone="muted" onClick={() => mutate()} disabled={isValidating}>
              Atualizar
            </SmallButton>
          </div>
        </div>

        <ErrorNote error={error} />

        <ol className="-mx-1 flex min-h-0 flex-1 flex-col overflow-y-auto px-1" aria-busy={isLoading}>
          {isLoading && <li className="py-8 text-center text-sm text-term-muted">Carregando logs...</li>}
          {!isLoading && events.length === 0 && <li className="py-8 text-center text-sm text-term-muted">Nenhum registro encontrado.</li>}
          {events.map((e) => (
            <li key={e.id} className="flex items-start gap-3 border-b border-term-line/60 py-2.5 last:border-0">
              <time dateTime={e.at} className="w-32 shrink-0 pt-0.5 font-mono text-xs text-term-muted">
                {dateTime(e.at)}
              </time>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge>{kindLabel[e.kind]}</Badge>
                  <span className="text-sm font-medium">{e.title}</span>
                  {e.account && <Badge tone={e.account === "real" ? "accent" : "muted"}>{e.account}</Badge>}
                  {e.status && <Badge tone={statusTone(e.status)}>{e.status}</Badge>}
                </div>
                {e.detail && <p className="truncate text-xs text-term-muted" title={e.detail}>{e.detail}</p>}
              </div>
              {e.amount != null && (
                <span className={cn("shrink-0 font-mono text-sm", e.amount >= 0 ? "text-long" : "text-short")}>{signedUsd(e.amount)}</span>
              )}
            </li>
          ))}
        </ol>

        {hasMore && (
          <SmallButton tone="muted" onClick={() => setSize(size + 1)} disabled={loadingMore}>
            {loadingMore ? "Carregando..." : "Carregar mais"}
          </SmallButton>
        )}
    </div>
  )
}

export function UserLogsDialog({ user, onClose }: { user: { id: string; email: string } | null; onClose: () => void }) {
  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-4 border-term-line bg-term-panel text-term-text sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Logs do usuário</DialogTitle>
          <DialogDescription className="text-term-muted">{user?.email}</DialogDescription>
        </DialogHeader>
        {user && <UserActivityFeed key={user.id} userId={user.id} />}
      </DialogContent>
    </Dialog>
  )
}
