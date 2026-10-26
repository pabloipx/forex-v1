"use client"

import { useState, type FormEvent } from "react"
import { toast } from "sonner"
import { Plus } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import { Badge, ErrorNote, Panel, SmallButton, inputCls } from "./ui"
import { adminAction, dateTime, refreshAdmin, useAdminView, usd } from "./use-admin"

type Status = "upcoming" | "live" | "ended"

interface Launch {
  id: string
  symbol: string
  name: string
  description: string | null
  icon_url: string | null
  website_url: string | null
  launch_at: string | null
  initial_price_usd: number | null
  total_supply: number | null
  status: Status
  visible: boolean
  sort_order: number
}

interface Draft {
  id?: string
  symbol: string
  name: string
  description: string
  icon_url: string
  website_url: string
  launch_at: string
  initial_price_usd: string
  total_supply: string
  status: Status
  visible: boolean
  sort_order: string
}

const STATUS_LABEL: Record<Status, string> = { upcoming: "Em breve", live: "Lançada", ended: "Encerrada" }
const STATUS_TONE: Record<Status, "accent" | "up" | "muted"> = { upcoming: "accent", live: "up", ended: "muted" }

const EMPTY: Draft = {
  symbol: "",
  name: "",
  description: "",
  icon_url: "",
  website_url: "",
  launch_at: "",
  initial_price_usd: "",
  total_supply: "",
  status: "upcoming",
  visible: true,
  sort_order: "0",
}

const toLocalInput = (iso: string | null) => {
  if (!iso) return ""
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

const toDraft = (l: Launch): Draft => ({
  id: l.id,
  symbol: l.symbol,
  name: l.name,
  description: l.description ?? "",
  icon_url: l.icon_url ?? "",
  website_url: l.website_url ?? "",
  launch_at: toLocalInput(l.launch_at),
  initial_price_usd: l.initial_price_usd == null ? "" : String(l.initial_price_usd),
  total_supply: l.total_supply == null ? "" : String(l.total_supply),
  status: l.status,
  visible: l.visible,
  sort_order: String(l.sort_order),
})

const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(/\./g, "").replace(",", ".")))

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1.5 text-xs text-term-muted">
      {label}
      {children}
      {hint && <span className="text-[11px] text-term-muted/80">{hint}</span>}
    </label>
  )
}

function LaunchForm({ initial, onDone }: { initial: Draft; onDone: () => void }) {
  const [d, setD] = useState<Draft>(initial)
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((cur) => ({ ...cur, [k]: v }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await adminAction({
        action: "save_launch",
        launch: {
          id: d.id,
          symbol: d.symbol,
          name: d.name,
          description: d.description || null,
          icon_url: d.icon_url || null,
          website_url: d.website_url || null,
          launch_at: d.launch_at ? new Date(d.launch_at).toISOString() : null,
          initial_price_usd: num(d.initial_price_usd),
          total_supply: num(d.total_supply),
          status: d.status,
          visible: d.visible,
          sort_order: Number.parseInt(d.sort_order || "0", 10),
        },
      })
      await refreshAdmin("launches")
      toast.success(d.id ? `${d.name} atualizada` : `${d.name} criada`)
      onDone()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!d.id || !window.confirm(`Excluir ${d.name}? Ela some da aba Lançamentos.`)) return
    setBusy(true)
    try {
      await adminAction({ action: "delete_launch", id: d.id })
      await refreshAdmin("launches")
      toast.success(`${d.name} excluída`)
      onDone()
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-3">
        <img
          src={d.icon_url || "/placeholder.svg?height=48&width=48&query=coin"}
          alt=""
          width={48}
          height={48}
          className="size-12 rounded-full border border-term-line bg-term-bg object-cover"
        />
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold">{d.name || "Nova moeda"}</span>
          <span className="font-mono text-xs text-term-muted">{d.symbol || "SÍMBOLO"}</span>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome">
          <input className={inputCls} value={d.name} onChange={(e) => set("name", e.target.value)} required maxLength={60} />
        </Field>
        <Field label="Símbolo" hint="Ex.: TSLCUSDT">
          <input
            className={inputCls}
            value={d.symbol}
            onChange={(e) => set("symbol", e.target.value.toUpperCase())}
            required
            maxLength={20}
          />
        </Field>
      </div>

      <Field label="Descrição">
        <textarea
          className={cn(inputCls, "h-24 resize-none py-2 font-sans leading-relaxed")}
          value={d.description}
          onChange={(e) => set("description", e.target.value)}
          maxLength={600}
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Ícone" hint="Caminho (/images/...) ou link https">
          <input className={inputCls} value={d.icon_url} onChange={(e) => set("icon_url", e.target.value)} />
        </Field>
        <Field label="Site oficial" hint="Opcional">
          <input className={inputCls} value={d.website_url} onChange={(e) => set("website_url", e.target.value)} placeholder="https://" />
        </Field>
        <Field label="Data de lançamento" hint="Vazio mostra só “Em breve”">
          <input type="datetime-local" className={inputCls} value={d.launch_at} onChange={(e) => set("launch_at", e.target.value)} />
        </Field>
        <Field label="Preço inicial (US$)">
          <input inputMode="decimal" className={inputCls} value={d.initial_price_usd} onChange={(e) => set("initial_price_usd", e.target.value)} />
        </Field>
        <Field label="Oferta total">
          <input inputMode="numeric" className={inputCls} value={d.total_supply} onChange={(e) => set("total_supply", e.target.value)} />
        </Field>
        <Field label="Ordem na lista">
          <input inputMode="numeric" className={inputCls} value={d.sort_order} onChange={(e) => set("sort_order", e.target.value)} />
        </Field>
      </div>

      <div className="flex flex-col gap-1.5 text-xs text-term-muted">
        Status
        <div role="radiogroup" aria-label="Status" className="flex gap-1 rounded-md border border-term-line bg-term-bg p-1">
          {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={d.status === s}
              onClick={() => set("status", s)}
              className={cn(
                "flex-1 rounded px-2 py-1.5 text-xs font-medium",
                d.status === s ? "bg-term-line text-term-text" : "text-term-muted hover:text-term-text",
              )}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-center justify-between gap-3 rounded-md border border-term-line px-3 py-2.5 text-sm">
        <span className="flex flex-col">
          Visível para clientes
          <span className="text-[11px] text-term-muted">Mostra a moeda na aba Lançamentos do terminal</span>
        </span>
        <Switch checked={d.visible} onCheckedChange={(v) => set("visible", v)} aria-label="Visível para clientes" />
      </label>

      <div className="flex flex-wrap items-center gap-2 border-t border-term-line pt-4">
        <SmallButton type="submit" tone="accent" disabled={busy}>
          {busy ? "Salvando..." : "Salvar"}
        </SmallButton>
        <SmallButton onClick={onDone} disabled={busy}>
          Cancelar
        </SmallButton>
        {d.id && (
          <span className="ml-auto">
            <SmallButton tone="down" onClick={remove} disabled={busy}>
              Excluir
            </SmallButton>
          </span>
        )}
      </div>
    </form>
  )
}

export function LaunchesSection() {
  const { data, error } = useAdminView<Launch[]>("launches", 15000)
  const [editing, setEditing] = useState<Draft | null>(null)

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
      <Panel
        title="Moedas em lançamento"
        action={
          <SmallButton tone="accent" onClick={() => setEditing({ ...EMPTY })}>
            <span className="flex items-center gap-1">
              <Plus className="size-3.5" aria-hidden="true" />
              Nova moeda
            </span>
          </SmallButton>
        }
      >
        <ErrorNote error={error} />
        <p className="border-b border-term-line px-4 py-2 text-[11px] leading-relaxed text-term-muted">
          Estas moedas aparecem na aba Lançamentos do terminal. Os clientes ainda não conseguem operá-las.
        </p>
        {data && data.length === 0 && (
          <p className="px-4 py-10 text-center text-xs text-term-muted">Nenhuma moeda cadastrada.</p>
        )}
        <ul>
          {(data ?? []).map((l) => (
            <li key={l.id} className="border-b border-term-line/60 last:border-0">
              <button
                onClick={() => setEditing(toDraft(l))}
                aria-current={editing?.id === l.id ? "true" : undefined}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-term-line/20",
                  editing?.id === l.id && "bg-primary/5",
                )}
              >
                <img
                  src={l.icon_url || "/placeholder.svg?height=36&width=36&query=coin"}
                  alt=""
                  width={36}
                  height={36}
                  className="size-9 shrink-0 rounded-full object-cover"
                />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex items-center gap-2 text-sm font-semibold">
                    {l.name}
                    {!l.visible && <Badge>Oculta</Badge>}
                  </span>
                  <span className="truncate text-xs text-term-muted">
                    {l.symbol}
                    {l.launch_at ? ` · ${dateTime(l.launch_at)}` : " · sem data"}
                    {l.initial_price_usd != null && ` · US$ ${usd(l.initial_price_usd, 4)}`}
                  </span>
                </span>
                <Badge tone={STATUS_TONE[l.status]}>{STATUS_LABEL[l.status]}</Badge>
              </button>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title={editing?.id ? "Editar moeda" : editing ? "Nova moeda" : "Detalhes"} className="lg:sticky lg:top-20">
        {editing ? (
          <LaunchForm key={editing.id ?? "new"} initial={editing} onDone={() => setEditing(null)} />
        ) : (
          <p className="px-4 py-10 text-center text-xs text-term-muted">Selecione uma moeda para editar ou crie uma nova.</p>
        )}
      </Panel>
    </div>
  )
}
