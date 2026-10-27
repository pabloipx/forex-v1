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
  presale_price_usd: number | null
  price_usd: number | null
  price_updated_at: string | null
  total_supply: number | null
  status: Status
  visible: boolean
  sort_order: number
  phase: "presale" | "live" | "ended"
  holders: { holders: number; qty: number; invested_usd: number } | null
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
  presale_price_usd: string
  price_usd: string
  total_supply: string
  status: Status
  visible: boolean
  sort_order: string
}

const STATUS_LABEL: Record<Status, string> = { upcoming: "Em breve", live: "Lançada", ended: "Encerrada" }
const STATUS_TONE: Record<Status, "accent" | "up" | "muted"> = { upcoming: "accent", live: "up", ended: "muted" }

const PHASE_LABEL = { presale: "Pré-venda", live: "Ao vivo", ended: "Encerrada" } as const
const PHASE_TONE = { presale: "accent", live: "up", ended: "muted" } as const

const EMPTY: Draft = {
  symbol: "",
  name: "",
  description: "",
  icon_url: "",
  website_url: "",
  launch_at: "",
  initial_price_usd: "",
  presale_price_usd: "",
  price_usd: "",
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
  presale_price_usd: l.presale_price_usd == null ? "" : String(l.presale_price_usd),
  price_usd: l.price_usd == null ? "" : String(l.price_usd),
  total_supply: l.total_supply == null ? "" : String(l.total_supply),
  status: l.status,
  visible: l.visible,
  sort_order: String(l.sort_order),
})

const num = (v: string) => {
  const t = v.trim()
  if (t === "") return null
  return Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t)
}

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
          initial_price_usd: num(d.initial_price_usd) ?? num(d.presale_price_usd),
          presale_price_usd: num(d.presale_price_usd),
          price_usd: num(d.price_usd),
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
    if (
      !d.id ||
      !window.confirm(
        `Apagar ${d.name} definitivamente? Quem comprou recebe de volta o valor pago no saldo real. Essa ação não pode ser desfeita.`,
      )
    )
      return
    setBusy(true)
    try {
      const res = (await adminAction({ action: "delete_launch", id: d.id })) as { refunded?: number }
      await refreshAdmin("launches", "users")
      toast.success(res.refunded ? `${d.name} apagada · ${res.refunded} cliente(s) reembolsado(s)` : `${d.name} apagada`)
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
        <Field label="Preço na pré-venda (US$)" hint="Cobrado antes do lançamento">
          <input inputMode="decimal" className={inputCls} value={d.presale_price_usd} onChange={(e) => set("presale_price_usd", e.target.value)} />
        </Field>
        <Field label="Preço no lançamento (US$)" hint="Preço de mercado após abrir">
          <input inputMode="decimal" className={inputCls} value={d.price_usd} onChange={(e) => set("price_usd", e.target.value)} />
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
              Apagar ativo
            </SmallButton>
          </span>
        )}
      </div>
    </form>
  )
}

const STEPS = [-10, -5, -1, 1, 5, 10]

function LaunchControls({ launch }: { launch: Launch }) {
  const [busy, setBusy] = useState(false)
  const [custom, setCustom] = useState("")
  const price = launch.price_usd ?? launch.initial_price_usd ?? 0
  const base = launch.presale_price_usd ?? launch.initial_price_usd
  const vsPresale = base ? ((price - base) / base) * 100 : null

  const run = async (body: Record<string, unknown>, msg: string) => {
    setBusy(true)
    try {
      await adminAction(body)
      await refreshAdmin("launches")
      toast.success(msg)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const setPrice = (p: number) => {
    if (!Number.isFinite(p) || p <= 0) return toast.error("Preço inválido")
    const rounded = Math.round(p * 100) / 100
    return run({ action: "set_launch_price", id: launch.id, price: rounded }, `Preço: US$ ${usd(rounded)}`)
  }

  return (
    <div className="flex flex-col gap-4 border-b border-term-line p-4">
      <div className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-xs text-term-muted">Preço de mercado</span>
          <span className="font-mono text-2xl font-semibold tabular-nums">US$ {usd(price)}</span>
          {vsPresale != null && (
            <span className={cn("text-xs", vsPresale >= 0 ? "text-adm-up" : "text-adm-down")}>
              {vsPresale >= 0 ? "+" : ""}
              {vsPresale.toFixed(1)}% vs pré-venda (US$ {usd(base)})
            </span>
          )}
        </div>
        <Badge tone={PHASE_TONE[launch.phase]}>{PHASE_LABEL[launch.phase]}</Badge>
      </div>

      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {STEPS.map((pct) => (
          <button
            key={pct}
            type="button"
            disabled={busy}
            onClick={() => setPrice(price * (1 + pct / 100))}
            className={cn(
              "min-h-10 rounded-md border text-xs font-semibold tabular-nums disabled:opacity-50",
              pct < 0 ? "border-adm-down/40 text-adm-down hover:bg-adm-down/10" : "border-adm-up/40 text-adm-up hover:bg-adm-up/10",
            )}
          >
            {pct > 0 ? "+" : ""}
            {pct}%
          </button>
        ))}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const p = num(custom)
          if (p == null || !Number.isFinite(p) || p <= 0) return void toast.error("Preço inválido")
          void setPrice(p)
          setCustom("")
        }}
      >
        <input
          inputMode="decimal"
          className={cn(inputCls, "flex-1")}
          placeholder="Definir preço exato (US$)"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          aria-label="Preço exato em USD"
        />
        <SmallButton type="submit" tone="accent" disabled={busy || !custom}>
          Aplicar
        </SmallButton>
      </form>

      {launch.holders && (
        <p className="text-xs leading-relaxed text-term-muted">
          {launch.holders.holders} comprador(es) · {launch.holders.qty.toLocaleString("pt-BR", { maximumFractionDigits: 4 })} moedas ·
          investido US$ {usd(launch.holders.invested_usd)} · valor atual US$ {usd(launch.holders.qty * price)}
        </p>
      )}

      <div className="flex items-center justify-between gap-3 rounded-md border border-term-line px-3 py-2.5 text-sm">
        <span className="flex flex-col">
          {launch.visible ? "Listada" : "Deslistada"}
          <span className="text-[11px] text-term-muted">
            {launch.visible ? "Clientes veem e negociam" : "Oculta e sem negociação; saldos dos clientes ficam guardados"}
          </span>
        </span>
        <SmallButton
          tone={launch.visible ? "down" : "accent"}
          disabled={busy}
          onClick={() =>
            run(
              { action: "set_launch_listed", id: launch.id, listed: !launch.visible },
              launch.visible ? `${launch.name} deslistada` : `${launch.name} listada`,
            )
          }
        >
          {launch.visible ? "Deslistar" : "Listar"}
        </SmallButton>
      </div>
    </div>
  )
}

export function LaunchesSection() {
  const { data, error } = useAdminView<Launch[]>("launches", 15000)
  const [editing, setEditing] = useState<Draft | null>(null)
  const current = data?.find((l) => l.id === editing?.id)

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
          Antes da data, clientes compram pelo preço de pré-venda. Depois do lançamento compram e vendem pelo preço que você define.
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
                    {l.phase === "presale"
                      ? l.presale_price_usd != null && ` · pré-venda US$ ${usd(l.presale_price_usd)}`
                      : l.price_usd != null && ` · US$ ${usd(l.price_usd)}`}
                    {l.holders && ` · ${l.holders.holders} comprador(es)`}
                  </span>
                </span>
                <Badge tone={PHASE_TONE[l.phase]}>{PHASE_LABEL[l.phase]}</Badge>
              </button>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title={editing?.id ? "Editar moeda" : editing ? "Nova moeda" : "Detalhes"} className="lg:sticky lg:top-20">
        {editing ? (
          <>
            {editing.id && current && <LaunchControls key={`c-${current.id}`} launch={current} />}
            <LaunchForm key={editing.id ?? "new"} initial={editing} onDone={() => setEditing(null)} />
          </>
        ) : (
          <p className="px-4 py-10 text-center text-xs text-term-muted">Selecione uma moeda para editar ou crie uma nova.</p>
        )}
      </Panel>
    </div>
  )
}
