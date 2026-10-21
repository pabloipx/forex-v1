"use client"

import { useEffect, useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { SCRIPT_TEMPLATES } from "@/lib/futures/script-runtime"
import type { ChartScript, useChartScripts } from "@/hooks/use-chart-scripts"

interface ScriptEditorProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  store: ReturnType<typeof useChartScripts>
  errors: Record<string, string>
}

const BLANK = `// Variáveis: open, high, low, close, volume, time, hl2, hlc3 (arrays)
// Funções: plot(serie, { title, color, width, pane: "price" | "separate", type: "line" | "histogram" })
//          hline(preco, { title, color, pane }) · signal(condicoes, { side: "buy" | "sell", text })
// Indicadores: ta.sma, ta.ema, ta.rma, ta.rsi, ta.atr, ta.bb, ta.macd, ta.vwap,
//              ta.stdev, ta.highest, ta.lowest, ta.change, ta.crossover, ta.crossunder

plot(ta.sma(close, 50), { title: "SMA 50", color: "#f7a600" })
`

export function ScriptEditor({ open, onOpenChange, store, errors }: ScriptEditorProps) {
  const { scripts, error, isLoading, create, update, remove } = store
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const selected = scripts.find((s) => s.id === selectedId) ?? null

  useEffect(() => {
    if (!open) return
    if (!selectedId && scripts.length) setSelectedId(scripts[0].id)
  }, [open, scripts, selectedId])

  useEffect(() => {
    if (selected) {
      setName(selected.name)
      setCode(selected.code)
    }
    setMessage(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id])

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true)
    setMessage(null)
    try {
      await fn()
      if (ok) setMessage(ok)
    } catch (e) {
      setMessage((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const createFrom = (tplName: string, tplCode: string) =>
    run(async () => {
      const row = await create(tplName, tplCode)
      setSelectedId(row.id)
    })

  const isPine = /^\s*\/\/\s*@version|^\s*(indicator|strategy|study)\s*\(/m.test(code)
  const sniperTemplate = SCRIPT_TEMPLATES.find((t) => t.name === "Sniper Pro V8")
  const isSniperPine = isPine && /SNIPER/i.test(code)

  const replaceWithConverted = () => {
    if (!selected || !sniperTemplate) return
    setCode(sniperTemplate.code)
    run(() => update(selected.id, { name: "Sniper Pro V8", code: sniperTemplate.code }), "Convertido e aplicado no gráfico")
    setName("Sniper Pro V8")
  }

  const dirty = !!selected && (selected.name !== name || selected.code !== code)

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault()
      const el = e.currentTarget
      const { selectionStart: s, selectionEnd: end } = el
      const next = code.slice(0, s) + "  " + code.slice(end)
      setCode(next)
      requestAnimationFrame(() => el.setSelectionRange(s + 2, s + 2))
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "s" && selected) {
      e.preventDefault()
      run(() => update(selected.id, { name, code }), "Salvo")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[80vh] max-h-[720px] flex-col gap-0 overflow-hidden border-term-line bg-term-panel p-0 text-term-text sm:max-w-4xl">
        <DialogHeader className="border-b border-term-line px-4 py-3">
          <DialogTitle className="text-sm">Scripts do gráfico</DialogTitle>
          <DialogDescription className="text-xs text-term-muted">
            Escreva indicadores em JavaScript. Eles rodam isolados no seu navegador e ficam salvos na sua conta.
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <p className="flex flex-1 items-center justify-center p-6 text-sm text-term-muted">{error.message}</p>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col md:flex-row">
            <aside className="flex max-h-48 shrink-0 flex-col border-b border-term-line md:max-h-none md:w-60 md:border-b-0 md:border-r">
              <div className="flex items-center justify-between px-3 py-2">
                <span className="text-xs font-medium text-term-muted">Meus scripts</span>
                <button
                  onClick={() => createFrom("Novo script", BLANK)}
                  disabled={busy}
                  className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-primary hover:bg-term-line disabled:opacity-50"
                >
                  <Plus className="size-3.5" aria-hidden="true" />
                  Novo
                </button>
              </div>
              <ul className="min-h-0 flex-1 overflow-y-auto">
                {isLoading && <li className="px-3 py-2 text-xs text-term-muted">Carregando...</li>}
                {!isLoading && scripts.length === 0 && (
                  <li className="px-3 py-2 text-xs leading-relaxed text-term-muted">Nenhum script ainda. Crie um ou use um modelo abaixo.</li>
                )}
                {scripts.map((s: ChartScript) => (
                  <li key={s.id}>
                    <div
                      className={cn(
                        "flex items-center gap-2 px-3 py-1.5 text-xs",
                        s.id === selectedId ? "bg-term-line text-term-text" : "text-term-muted hover:bg-term-line/50",
                      )}
                    >
                      <button onClick={() => setSelectedId(s.id)} className="flex min-w-0 flex-1 items-center gap-1.5 text-left">
                        <span
                          className={cn("size-1.5 shrink-0 rounded-full", errors[s.id] ? "bg-term-down" : s.enabled ? "bg-term-up" : "bg-term-muted")}
                          aria-hidden="true"
                        />
                        <span className="truncate">{s.name}</span>
                      </button>
                      <Switch
                        checked={s.enabled}
                        onCheckedChange={(v) => run(() => update(s.id, { enabled: v }))}
                        aria-label={`Ativar ${s.name}`}
                        className="scale-75"
                      />
                    </div>
                  </li>
                ))}
              </ul>
              <div className="border-t border-term-line px-3 py-2">
                <span className="text-xs font-medium text-term-muted">Modelos</span>
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {SCRIPT_TEMPLATES.map((t) => (
                    <button
                      key={t.name}
                      onClick={() => createFrom(t.name, t.code)}
                      disabled={busy}
                      className="rounded border border-term-line px-1.5 py-0.5 text-[11px] text-term-muted hover:text-term-text disabled:opacity-50"
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
            </aside>

            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              {selected ? (
                <>
                  <div className="flex items-center gap-2 border-b border-term-line px-3 py-2">
                    <label htmlFor="script-name" className="sr-only">
                      Nome do script
                    </label>
                    <input
                      id="script-name"
                      value={name}
                      maxLength={60}
                      onChange={(e) => setName(e.target.value)}
                      className="min-w-0 flex-1 rounded border border-term-line bg-transparent px-2 py-1 text-sm outline-none focus:border-primary"
                    />
                    <button
                      onClick={() => run(() => update(selected.id, { name, code }), "Salvo")}
                      disabled={busy || !dirty}
                      className="rounded bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-40"
                    >
                      Salvar e aplicar
                    </button>
                    <button
                      onClick={() =>
                        run(async () => {
                          await remove(selected.id)
                          setSelectedId(null)
                        })
                      }
                      disabled={busy}
                      aria-label="Excluir script"
                      className="rounded p-1.5 text-term-muted hover:bg-term-line hover:text-term-down disabled:opacity-50"
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                  <label htmlFor="script-code" className="sr-only">
                    Código do script
                  </label>
                  <textarea
                    id="script-code"
                    value={code}
                    maxLength={20000}
                    spellCheck={false}
                    onChange={(e) => setCode(e.target.value)}
                    onKeyDown={onKeyDown}
                    className="min-h-0 flex-1 resize-none bg-term-bg p-3 font-mono text-[13px] leading-relaxed text-term-text outline-none"
                  />
                  <div className="flex min-h-9 items-center gap-2 border-t border-term-line px-3 py-2 font-mono text-[11px]">
                  {isPine ? (
                    <>
                      <span className="text-term-down">
                        {isSniperPine
                          ? "Este é o Pine Script do Sniper. O gráfico usa JavaScript — converta com um clique."
                          : "Pine Script (TradingView) não é suportado. Use JavaScript com ta, plot, hline e signal."}
                      </span>
                      {isSniperPine && sniperTemplate && (
                        <button
                          onClick={replaceWithConverted}
                          disabled={busy}
                          className="ml-auto shrink-0 rounded bg-primary px-2.5 py-1 font-sans text-xs font-semibold text-primary-foreground disabled:opacity-50"
                        >
                          Converter e aplicar
                        </button>
                      )}
                    </>
                  ) : errors[selected.id] ? (
                    <span className="text-term-down">Erro: {errors[selected.id]}</span>
                  ) : message ? (
                      <span className="text-term-muted">{message}</span>
                    ) : (
                      <span className="text-term-muted">
                        {selected.enabled ? "Ativo no gráfico" : "Desativado"} · Ctrl/Cmd+S salva
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <p className="flex flex-1 items-center justify-center p-6 text-sm text-term-muted">Selecione ou crie um script.</p>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
