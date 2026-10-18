"use client"

import { useEffect, useState } from "react"
import useSWR from "swr"
import { RefreshCw } from "lucide-react"
import type { GatewayHealth } from "@/lib/suitpay"
import { cn } from "@/lib/utils"
import { ErrorNote, Panel } from "./ui"

type Resp = { health: GatewayHealth; lastPixAt: string | null; serverTime: string }

const fetcher = async (url: string): Promise<Resp> => {
  const res = await fetch(url, { cache: "no-store" })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? "Erro ao verificar gateway")
  return json
}

const STATUS: Record<GatewayHealth["status"], { label: string; tone: "up" | "down" | "warn" }> = {
  online: { label: "ON", tone: "up" },
  auth_error: { label: "CREDENCIAIS", tone: "warn" },
  offline: { label: "OFF", tone: "down" },
  not_configured: { label: "NÃO CONFIGURADO", tone: "warn" },
}

const toneText = { up: "text-long", down: "text-short", warn: "text-primary" }
const toneDot = { up: "bg-long", down: "bg-short", warn: "bg-primary" }

const TZ = "America/Sao_Paulo"

function LiveClock({ offsetMs }: { offsetMs: number }) {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    const tick = () => setNow(Date.now() + offsetMs)
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [offsetMs])

  const d = now == null ? null : new Date(now)
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-5xl font-semibold tabular-nums tracking-tight text-term-text md:text-6xl" aria-live="off">
        {d ? d.toLocaleTimeString("pt-BR", { timeZone: TZ, hour12: false }) : "--:--:--"}
      </span>
      <span className="text-sm text-term-muted first-letter:uppercase">
        {d ? d.toLocaleDateString("pt-BR", { timeZone: TZ, weekday: "long", day: "2-digit", month: "long", year: "numeric" }) : "\u00a0"}
      </span>
      <span className="text-[11px] text-term-muted">Horário de Brasília, sincronizado com o servidor</span>
    </div>
  )
}

function Row({ label, value, mono = true }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-term-line/60 px-4 py-2.5 text-xs last:border-0">
      <span className="text-term-muted">{label}</span>
      <span className={cn("truncate text-right text-term-text", mono && "font-mono tabular-nums")}>{value}</span>
    </div>
  )
}

export function GatewaySection() {
  const [history, setHistory] = useState<GatewayHealth[]>([])
  const [offsetMs, setOffsetMs] = useState(0)
  const { data, error, isValidating, mutate } = useSWR("/api/admin/gateway", fetcher, {
    refreshInterval: 10_000,
    revalidateOnFocus: true,
    onSuccess: (r) => {
      setOffsetMs(new Date(r.serverTime).getTime() - Date.now())
      setHistory((h) => [r.health, ...h].slice(0, 30))
    },
  })

  const h = data?.health
  const s = h ? STATUS[h.status] : null
  const okCount = history.filter((x) => x.status === "online").length
  const latencies = history.map((x) => x.latencyMs).filter((x): x is number => x != null)
  const avgLatency = latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Relógio">
          <div className="p-6">
            <LiveClock offsetMs={offsetMs} />
          </div>
        </Panel>

        <Panel
          title="SuitPay · API PIX"
          action={
            <button
              type="button"
              onClick={() => mutate()}
              disabled={isValidating}
              className="flex items-center gap-1.5 rounded px-2 py-1 text-xs text-term-muted hover:text-term-text disabled:opacity-50"
            >
              <RefreshCw className={cn("size-3.5", isValidating && "animate-spin")} aria-hidden="true" />
              Verificar agora
            </button>
          }
        >
          <ErrorNote error={error} />
          <div className="flex items-center gap-5 p-6">
            <span className="relative flex size-4 shrink-0" aria-hidden="true">
              {s && s.tone === "up" && <span className="absolute inline-flex size-full animate-ping rounded-full bg-long opacity-60" />}
              <span className={cn("relative inline-flex size-4 rounded-full", s ? toneDot[s.tone] : "bg-term-line")} />
            </span>
            <div className="flex min-w-0 flex-col gap-1">
              <span className={cn("font-mono text-5xl font-semibold tracking-tight md:text-6xl", s ? toneText[s.tone] : "text-term-muted")}>
                {s?.label ?? "..."}
              </span>
              <span className="text-sm text-term-muted" role="status">
                {h?.message ?? "Verificando conexão..."}
              </span>
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Detalhes">
          <Row label="Ambiente" value={h ? (h.environment === "sandbox" ? "Sandbox" : "Produção") : "—"} mono={false} />
          <Row label="Latência" value={h?.latencyMs != null ? `${h.latencyMs} ms` : "—"} />
          <Row label="Latência média" value={avgLatency != null ? `${avgLatency} ms` : "—"} />
          <Row label="Disponibilidade (sessão)" value={history.length ? `${okCount}/${history.length} verificações` : "—"} />
          <Row
            label="Último PIX gerado"
            value={
              data?.lastPixAt
                ? new Date(data.lastPixAt).toLocaleString("pt-BR", { timeZone: TZ, hour12: false, dateStyle: "short", timeStyle: "medium" })
                : "—"
            }
          />
          <Row label="Host" value={h?.host ?? "—"} />
          <Row label="Webhook" value={h?.callbackUrl ?? "—"} />
          <Row
            label="Última verificação"
            value={h ? new Date(h.checkedAt).toLocaleTimeString("pt-BR", { timeZone: TZ, hour12: false }) : "—"}
          />
        </Panel>

        <Panel title="Verificações recentes">
          {history.length === 0 ? (
            <p className="px-4 py-10 text-center text-xs text-term-muted">Aguardando a primeira verificação.</p>
          ) : (
            <div className="flex flex-col gap-3 p-4">
              <div className="flex h-8 items-end gap-1" aria-label="Histórico de status, mais recente à direita">
                {[...history].reverse().map((x, i) => (
                  <span
                    key={`${x.checkedAt}-${i}`}
                    title={`${new Date(x.checkedAt).toLocaleTimeString("pt-BR", { timeZone: TZ })} · ${STATUS[x.status].label}`}
                    className={cn("h-full flex-1 rounded-sm", toneDot[STATUS[x.status].tone])}
                  />
                ))}
              </div>
              <ul className="flex flex-col">
                {history.slice(0, 8).map((x, i) => (
                  <li key={`${x.checkedAt}-${i}`} className="flex items-center justify-between border-b border-term-line/60 py-2 text-xs last:border-0">
                    <span className="font-mono tabular-nums text-term-muted">
                      {new Date(x.checkedAt).toLocaleTimeString("pt-BR", { timeZone: TZ, hour12: false })}
                    </span>
                    <span className={cn("font-mono font-medium", toneText[STATUS[x.status].tone])}>{STATUS[x.status].label}</span>
                    <span className="w-16 text-right font-mono tabular-nums text-term-muted">{x.latencyMs != null ? `${x.latencyMs} ms` : "—"}</span>
                  </li>
                ))}
              </ul>
              <span className="text-[11px] text-term-muted">Verificação automática a cada 10 segundos.</span>
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}
