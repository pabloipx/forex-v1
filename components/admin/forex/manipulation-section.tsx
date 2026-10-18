"use client"

import { useMemo, useState } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import { Clock, Square, Trash2, TrendingDown, TrendingUp, Zap } from "lucide-react"
import { CATEGORY_LABELS, MARKETS, formatPrice, getMarket, type MarketCategory } from "@/lib/futures/markets"
import { PHASE_LABELS, intensityAt, type FuturesManipulation, type ManipulationPhase } from "@/lib/futures/manipulation-curve"
import { cn } from "@/lib/utils"
import { Badge, DataTable, ErrorNote, Panel, SmallButton, inputCls, td } from "./ui"

type Row = FuturesManipulation & {
  phase: ManipulationPhase
  effective_end: string
  offset_pct: number
  real_price: number | null
  price: number | null
}

const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: "no-store" })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error ?? "Erro ao carregar")
  return json
}

const PROFILES = [
  { id: "quick", label: "Rápido", desc: "Sobe em 1 min, segura 2 min, devolve em 1 min", ramp: 60, hold: 120, release: 60 },
  { id: "steady", label: "Gradual", desc: "Sobe em 5 min, segura 10 min, devolve em 5 min", ramp: 300, hold: 600, release: 300 },
  { id: "long", label: "Prolongado", desc: "Sobe em 15 min, segura 1 h, devolve em 15 min", ramp: 900, hold: 3600, release: 900 },
  { id: "custom", label: "Personalizado", desc: "Defina cada fase em segundos", ramp: 0, hold: 0, release: 0 },
] as const

const MOVE_PRESETS = [0.1, 0.25, 0.5, 1, 2, 5]
const CATEGORIES = Object.keys(CATEGORY_LABELS) as MarketCategory[]

const fmtDuration = (s: number) => {
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.round(s / 60)} min`
  const h = Math.floor(s / 3600)
  const m = Math.round((s % 3600) / 60)
  return m ? `${h} h ${m} min` : `${h} h`
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })

const phaseTone = (p: ManipulationPhase) =>
  p === "ramp" || p === "hold" ? "accent" : p === "release" ? "up" : "muted"

function Choice({ active, onClick, children, className }: { active: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex h-9 items-center justify-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors",
        active ? "border-primary bg-primary/10 text-primary" : "border-term-line text-term-muted hover:text-term-text",
        className,
      )}
    >
      {children}
    </button>
  )
}

function CurvePreview({ ramp, hold, release, direction }: { ramp: number; hold: number; release: number; direction: "up" | "down" }) {
  const total = ramp + hold + release
  const W = 360
  const H = 72
  const pad = 6
  const path = useMemo(() => {
    if (total <= 0) return ""
    const fake = {
      start_time: new Date(0).toISOString(),
      ramp_seconds: ramp,
      hold_seconds: hold,
      release_seconds: release,
      stopped_at: null,
    } as FuturesManipulation
    const pts: string[] = []
    for (let i = 0; i <= 80; i++) {
      const t = (i / 80) * total * 1000
      const v = intensityAt(fake, t)
      const x = pad + (i / 80) * (W - pad * 2)
      const y = direction === "up" ? H - pad - v * (H - pad * 2) : pad + v * (H - pad * 2)
      pts.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    }
    return pts.join(" ")
  }, [ramp, hold, release, direction, total])

  const base = direction === "up" ? H - pad : pad
  const x1 = pad + (ramp / total) * (W - pad * 2)
  const x2 = pad + ((ramp + hold) / total) * (W - pad * 2)
  const color = direction === "up" ? "var(--color-long)" : "var(--color-short)"

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-term-line bg-term-bg p-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-16 w-full" role="img" aria-label="Prévia do deslocamento ao longo do tempo">
        <line x1={pad} x2={W - pad} y1={base} y2={base} stroke="currentColor" className="text-term-line" strokeDasharray="3 3" />
        {total > 0 && (
          <>
            <line x1={x1} x2={x1} y1={pad} y2={H - pad} stroke="currentColor" className="text-term-line" />
            <line x1={x2} x2={x2} y1={pad} y2={H - pad} stroke="currentColor" className="text-term-line" />
            <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
          </>
        )}
      </svg>
      <div className="grid grid-cols-3 text-center text-[10px] text-term-muted">
        <span>Subida {fmtDuration(ramp)}</span>
        <span>Manter {fmtDuration(hold)}</span>
        <span>Volta {fmtDuration(release)}</span>
      </div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs text-term-muted">{label}</span>
      {children}
      {hint && <span className="text-[11px] leading-relaxed text-term-muted">{hint}</span>}
    </div>
  )
}

export function ManipulationSection() {
  const { data, error, mutate } = useSWR<{ manipulations: Row[] }>("/api/admin/manipulations", fetcher, { refreshInterval: 2000 })
  const { data: tick } = useSWR<{ tickers: Record<string, { price: number }> }>("/api/futures/tickers", fetcher, { refreshInterval: 3000 })

  const [category, setCategory] = useState<MarketCategory>("crypto")
  const [symbol, setSymbol] = useState("BTCUSDT")
  const [direction, setDirection] = useState<"up" | "down">("up")
  const [movePct, setMovePct] = useState("0.5")
  const [profile, setProfile] = useState<(typeof PROFILES)[number]["id"]>("steady")
  const [custom, setCustom] = useState({ ramp: "120", hold: "300", release: "120" })
  const [scheduled, setScheduled] = useState(false)
  const [startAt, setStartAt] = useState("")
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState<string | null>(null)

  const market = getMarket(symbol)!
  const price = tick?.tickers?.[symbol]?.price ?? null
  const pct = Number(movePct)
  const target = price != null && pct > 0 ? price * (1 + (direction === "up" ? 1 : -1) * (pct / 100)) : null
  const [targetDraft, setTargetDraft] = useState<string | null>(null)

  const applyTarget = (raw: string) => {
    setTargetDraft(raw)
    const v = Number(raw.replace(",", "."))
    if (!price || !(v > 0)) return
    const diff = (v / price - 1) * 100
    if (Math.abs(diff) < 0.001) return
    setDirection(diff > 0 ? "up" : "down")
    setMovePct(String(Number(Math.abs(diff).toFixed(3))))
  }

  const timing = useMemo(() => {
    if (profile !== "custom") {
      const p = PROFILES.find((x) => x.id === profile)!
      return { ramp: p.ramp, hold: p.hold, release: p.release }
    }
    return { ramp: Number(custom.ramp) || 0, hold: Number(custom.hold) || 0, release: Number(custom.release) || 0 }
  }, [profile, custom])
  const total = timing.ramp + timing.hold + timing.release

  const rows = data?.manipulations ?? []
  const live = rows.filter((r) => r.phase !== "done")
  const history = rows.filter((r) => r.phase === "done")
  const busySymbols = new Set(live.map((r) => r.symbol))

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!(pct > 0 && pct <= 20)) return toast.error("Movimento deve ficar entre 0,01% e 20%")
    if (timing.ramp < 5 || timing.release < 5) return toast.error("Subida e devolução precisam de pelo menos 5 s")
    if (scheduled && !startAt) return toast.error("Informe o horário de início")
    setBusy("create")
    try {
      const res = await fetch("/api/admin/manipulations", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          symbol,
          direction,
          movePct: pct,
          rampSeconds: timing.ramp,
          holdSeconds: timing.hold,
          releaseSeconds: timing.release,
          startAt: scheduled ? new Date(startAt).toISOString() : undefined,
          note,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      toast.success(scheduled ? "Manipulação agendada" : "Manipulação iniciada")
      setNote("")
      await mutate()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const act = async (id: string, method: "PATCH" | "DELETE") => {
    if (method === "DELETE" && !confirm("Remover este registro? Se estiver em vigor, o preço volta ao real imediatamente.")) return
    setBusy(id)
    try {
      const res = await fetch(`/api/admin/manipulations?id=${id}`, { method })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      toast.success(method === "PATCH" ? "Interrompida: o preço volta ao real suavemente" : "Removida")
      await mutate()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-pretty text-sm leading-relaxed text-term-muted">
        Desloca o preço de um mercado de futuros em relação ao feed real. O deslocamento vale para todo o sistema: gráfico,
        livro, execução de ordens, TP/SL e liquidações. Ao terminar, o preço converge de volta ao real sem saltos.
      </p>

      <div className="grid gap-4 xl:grid-cols-[400px_1fr]">
        <Panel title="Nova manipulação">
          <form onSubmit={create} className="flex flex-col gap-5 p-4">
            <Field label="Mercado">
              <div role="radiogroup" aria-label="Categoria" className="flex gap-1">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={category === c}
                    onClick={() => {
                      setCategory(c)
                      setSymbol(MARKETS.find((m) => m.category === c)!.symbol)
                    }}
                    className={cn("rounded px-2 py-1 text-xs", category === c ? "bg-term-line text-term-text" : "text-term-muted hover:text-term-text")}
                  >
                    {CATEGORY_LABELS[c]}
                  </button>
                ))}
              </div>
              <select value={symbol} onChange={(e) => setSymbol(e.target.value)} className={inputCls} aria-label="Mercado">
                {MARKETS.filter((m) => m.category === category).map((m) => (
                  <option key={m.symbol} value={m.symbol}>
                    {m.symbol} — {m.name}
                    {busySymbols.has(m.symbol) ? " (em andamento)" : ""}
                  </option>
                ))}
              </select>
              <div className="flex items-center justify-between rounded-md border border-term-line bg-term-bg px-3 py-2 text-xs">
                <span className="text-term-muted">Preço atual</span>
                <span className="font-mono tabular-nums text-term-text">{price == null ? "—" : formatPrice(price, market.priceDecimals)}</span>
              </div>
            </Field>

            <Field label="Direção">
              <div className="grid grid-cols-2 gap-2">
                <Choice active={direction === "up"} onClick={() => setDirection("up")} className={direction === "up" ? "border-long bg-long/10 text-long" : ""}>
                  <TrendingUp className="h-4 w-4" aria-hidden /> Alta
                </Choice>
                <Choice active={direction === "down"} onClick={() => setDirection("down")} className={direction === "down" ? "border-short bg-short/10 text-short" : ""}>
                  <TrendingDown className="h-4 w-4" aria-hidden /> Baixa
                </Choice>
              </div>
            </Field>

            <Field label="Tamanho do movimento (%)">
              <div className="grid grid-cols-6 gap-1">
                {MOVE_PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setMovePct(String(p))}
                    className={cn(
                      "h-8 rounded border font-mono text-xs",
                      Number(movePct) === p ? "border-primary text-primary" : "border-term-line text-term-muted hover:text-term-text",
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <input
                type="number"
                inputMode="decimal"
                min={0.01}
                max={20}
                step={0.01}
                value={movePct}
                onChange={(e) => setMovePct(e.target.value)}
                className={inputCls}
                aria-label="Movimento em porcentagem"
              />
              <label className="flex items-center justify-between gap-3 rounded-md border border-term-line bg-term-bg px-3 py-1 text-xs focus-within:border-primary">
                <span className="shrink-0 text-term-muted">Preço alvo</span>
                <input
                  inputMode="decimal"
                  value={targetDraft ?? (target == null ? "" : target.toFixed(market.priceDecimals))}
                  onChange={(e) => applyTarget(e.target.value)}
                  onBlur={() => setTargetDraft(null)}
                  placeholder="—"
                  aria-label="Preço alvo"
                  className={cn(
                    "h-7 w-full min-w-0 bg-transparent text-right font-mono tabular-nums outline-none",
                    direction === "up" ? "text-long" : "text-short",
                  )}
                />
              </label>
              <span className="text-[11px] leading-relaxed text-term-muted">
                Digite a % ou o preço alvo direto — um calcula o outro.
              </span>
              {pct > 3 && (
                <span className="text-[11px] leading-relaxed text-short">
                  Movimentos acima de 3% chamam atenção e podem liquidar muitas posições de uma vez.
                </span>
              )}
            </Field>

            <Field label="Perfil de tempo" hint={profile === "custom" ? undefined : PROFILES.find((p) => p.id === profile)!.desc}>
              <div className="grid grid-cols-2 gap-2">
                {PROFILES.map((p) => (
                  <Choice key={p.id} active={profile === p.id} onClick={() => setProfile(p.id)}>
                    {p.label}
                  </Choice>
                ))}
              </div>
              {profile === "custom" && (
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ["ramp", "Subida (s)"],
                      ["hold", "Manter (s)"],
                      ["release", "Devolver (s)"],
                    ] as const
                  ).map(([k, l]) => (
                    <label key={k} className="flex flex-col gap-1 text-[11px] text-term-muted">
                      {l}
                      <input
                        type="number"
                        min={k === "hold" ? 0 : 5}
                        value={custom[k]}
                        onChange={(e) => setCustom((c) => ({ ...c, [k]: e.target.value }))}
                        className={inputCls}
                      />
                    </label>
                  ))}
                </div>
              )}
              <CurvePreview ramp={timing.ramp} hold={timing.hold} release={timing.release} direction={direction} />
              <span className="text-[11px] text-term-muted">Duração total: {fmtDuration(total)}</span>
            </Field>

            <Field label="Quando aplicar">
              <div className="grid grid-cols-2 gap-2">
                <Choice active={!scheduled} onClick={() => setScheduled(false)}>
                  <Zap className="h-4 w-4" aria-hidden /> Agora
                </Choice>
                <Choice active={scheduled} onClick={() => setScheduled(true)}>
                  <Clock className="h-4 w-4" aria-hidden /> Agendar
                </Choice>
              </div>
              {scheduled && (
                <input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} className={inputCls} aria-label="Horário de início" />
              )}
            </Field>

            <Field label="Observação (opcional)">
              <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={140} className={inputCls} placeholder="Motivo interno" />
            </Field>

            {busySymbols.has(symbol) && (
              <p className="text-[11px] leading-relaxed text-term-muted">
                Já existe uma manipulação em andamento neste mercado. Os deslocamentos se somam.
              </p>
            )}

            {price != null && target != null && (
              <p className="rounded-md border border-term-line bg-term-bg px-3 py-2 text-xs leading-relaxed text-term-muted">
                <span className="font-mono text-term-text">{symbol}</span> vai {direction === "up" ? "subir" : "cair"} de{" "}
                <span className="font-mono text-term-text">{formatPrice(price, market.priceDecimals)}</span> para{" "}
                <span className={cn("font-mono", direction === "up" ? "text-long" : "text-short")}>
                  {formatPrice(target, market.priceDecimals)}
                </span>{" "}
                em {fmtDuration(timing.ramp)}
                {timing.hold > 0 ? `, ficar lá por ${fmtDuration(timing.hold)}` : ""} e voltar ao preço real em{" "}
                {fmtDuration(timing.release)}
                {scheduled && startAt ? `, começando em ${fmtTime(new Date(startAt).toISOString())}` : ""}.
              </p>
            )}

            <button
              type="submit"
              disabled={busy === "create"}
              className="h-10 rounded-md bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {busy === "create" ? "Enviando..." : scheduled ? "Agendar manipulação" : "Iniciar manipulação"}
            </button>
          </form>
        </Panel>

        <div className="flex min-w-0 flex-col gap-4">
          <Panel title={`Em andamento (${live.length})`}>
            <ErrorNote error={error} />
            {live.length === 0 ? (
              <p className="px-4 py-10 text-center text-xs text-term-muted">Nenhuma manipulação ativa ou agendada.</p>
            ) : (
              <ul className="divide-y divide-term-line">
                {live.map((m) => {
                  const mk = getMarket(m.symbol)
                  const dec = mk?.priceDecimals ?? 2
                  const start = new Date(m.start_time).getTime()
                  const end = new Date(m.effective_end).getTime()
                  const now = Date.now()
                  const progress = m.phase === "scheduled" ? 0 : Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100))
                  return (
                    <li key={m.id} className="flex flex-col gap-3 px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-term-text">{m.symbol}</span>
                        <Badge tone={m.direction === "up" ? "up" : "down"}>
                          {m.direction === "up" ? "Alta" : "Baixa"} {m.move_pct}%
                        </Badge>
                        <Badge tone={phaseTone(m.phase)}>{PHASE_LABELS[m.phase]}</Badge>
                        {m.stopped_at && <Badge>Interrompida</Badge>}
                        <div className="ml-auto flex gap-1.5">
                          {!m.stopped_at && (
                            <SmallButton onClick={() => act(m.id, "PATCH")} disabled={busy === m.id}>
                              <span className="flex items-center gap-1">
                                <Square className="h-3 w-3" aria-hidden /> Parar
                              </span>
                            </SmallButton>
                          )}
                          <SmallButton tone="down" onClick={() => act(m.id, "DELETE")} disabled={busy === m.id}>
                            <span className="flex items-center gap-1">
                              <Trash2 className="h-3 w-3" aria-hidden /> Remover
                            </span>
                          </SmallButton>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-term-muted">Preço real</span>
                          <span className="font-mono tabular-nums text-term-text">{m.real_price == null ? "—" : formatPrice(m.real_price, dec)}</span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-term-muted">Preço exibido</span>
                          <span className="font-mono tabular-nums text-term-text">{m.price == null ? "—" : formatPrice(m.price, dec)}</span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-term-muted">Deslocamento</span>
                          <span className={cn("font-mono tabular-nums", m.offset_pct > 0 ? "text-long" : m.offset_pct < 0 ? "text-short" : "text-term-text")}>
                            {m.offset_pct >= 0 ? "+" : ""}
                            {m.offset_pct.toFixed(3)}%
                          </span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-term-muted">{m.phase === "scheduled" ? "Começa" : "Termina"}</span>
                          <span className="font-mono tabular-nums text-term-text">{fmtTime(m.phase === "scheduled" ? m.start_time : m.effective_end)}</span>
                        </div>
                      </div>
                      <div
                        className="h-1.5 overflow-hidden rounded-full bg-term-line"
                        role="progressbar"
                        aria-valuenow={Math.round(progress)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label="Progresso"
                      >
                        <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                      </div>
                      <span className="text-[11px] text-term-muted">
                        Subida {fmtDuration(m.ramp_seconds)} · Manter {fmtDuration(m.hold_seconds)} · Devolução {fmtDuration(m.release_seconds)}
                        {m.note ? ` · ${m.note}` : ""}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </Panel>

          <Panel title="Histórico">
            <DataTable head={["Mercado", "Direção", "Movimento", "Início", "Fim", "Status", ""]} empty={history.length === 0 && "Sem histórico."}>
              {history.map((m) => (
                <tr key={m.id} className="border-b border-term-line/60 last:border-0">
                  <td className={td}>{m.symbol}</td>
                  <td className={td}>
                    <Badge tone={m.direction === "up" ? "up" : "down"}>{m.direction === "up" ? "Alta" : "Baixa"}</Badge>
                  </td>
                  <td className={td}>{m.move_pct}%</td>
                  <td className={td}>{fmtTime(m.start_time)}</td>
                  <td className={td}>{fmtTime(m.effective_end)}</td>
                  <td className={td}>
                    <Badge>{m.stopped_at ? "Interrompida" : "Concluída"}</Badge>
                  </td>
                  <td className={td}>
                    <SmallButton tone="down" onClick={() => act(m.id, "DELETE")} disabled={busy === m.id}>
                      Remover
                    </SmallButton>
                  </td>
                </tr>
              ))}
            </DataTable>
          </Panel>
        </div>
      </div>
    </div>
  )
}
