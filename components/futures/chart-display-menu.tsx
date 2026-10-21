"use client"

import { useRef, useState } from "react"
import { Check, ChevronRight, ListFilter } from "lucide-react"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export interface ChartDisplaySettings {
  quickMarket: boolean
  quickLimit: boolean
  currentOrders: boolean
  avgBuy: boolean
  avgSell: boolean
  tradeHistory: boolean
  calendar: boolean
  syncDrawings: boolean
}

export const DEFAULT_DISPLAY_SETTINGS: ChartDisplaySettings = {
  quickMarket: false,
  quickLimit: true,
  currentOrders: true,
  avgBuy: false,
  avgSell: false,
  tradeHistory: true,
  calendar: true,
  syncDrawings: false,
}

type Key = keyof ChartDisplaySettings

const SECTIONS: { title: string; items: { key: Key; label: string; hint?: string; more?: boolean }[] }[] = [
  {
    title: "Trading rápido",
    items: [
      { key: "quickMarket", label: "Ordem a mercado" },
      { key: "quickLimit", label: "Ordem de limite" },
    ],
  },
  {
    title: "Exibição de ordens",
    items: [
      { key: "currentOrders", label: "Ordens atuais", more: true },
      { key: "avgBuy", label: "Preço médio de compra", hint: "Último 7D", more: true },
      { key: "avgSell", label: "Preço médio de venda", hint: "Último 7D", more: true },
      { key: "tradeHistory", label: "Histórico de trades", more: true },
      { key: "calendar", label: "Calendário econômico", more: true },
      { key: "syncDrawings", label: "Sincronizar desenhos e indicadores com o aplicativo" },
    ],
  },
]

interface ChartDisplayMenuProps {
  value: ChartDisplaySettings
  onChange: (next: ChartDisplaySettings) => void
  className?: string
}

export function ChartDisplayMenu({ value, onChange, className }: ChartDisplayMenuProps) {
  const [open, setOpen] = useState(false)
  const closeTimer = useRef<number | null>(null)

  const cancelClose = () => {
    if (closeTimer.current) window.clearTimeout(closeTimer.current)
    closeTimer.current = null
  }
  const openOnHover = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return
    cancelClose()
    setOpen(true)
  }
  const closeOnLeave = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return
    cancelClose()
    closeTimer.current = window.setTimeout(() => setOpen(false), 150)
  }

  const activeCount = Object.values(value).filter(Boolean).length

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        title="Exibição de ordens"
        aria-label="Exibição de ordens"
        onPointerEnter={openOnHover}
        onPointerLeave={closeOnLeave}
        className={className}
      >
        <ListFilter className="size-4" strokeWidth={1.5} aria-hidden="true" />
        {activeCount > 0 && <span className="absolute right-1 top-1 size-1.5 rounded-full bg-term-down" aria-hidden="true" />}
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={6}
        collisionPadding={8}
        onPointerEnter={openOnHover}
        onPointerLeave={closeOnLeave}
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="flex w-[min(20rem,calc(100vw-1rem))] flex-col gap-1 border-term-line bg-term-panel p-2 text-term-text shadow-xl"
      >
        {SECTIONS.map((section) => (
          <div key={section.title} role="group" aria-label={section.title} className="flex flex-col">
            <p className="px-2 pb-1 pt-1.5 text-xs text-term-muted">{section.title}</p>
            {section.items.map((item) => {
              const checked = value[item.key]
              return (
                <button
                  key={item.key}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={checked}
                  onClick={() => onChange({ ...value, [item.key]: !checked })}
                  className="flex min-h-11 items-center gap-2.5 rounded px-2 text-left text-sm transition-colors hover:bg-term-line/60"
                >
                  <span
                    className={cn(
                      "flex size-4 shrink-0 items-center justify-center rounded-[3px] border",
                      checked ? "border-term-accent bg-term-accent text-term-panel" : "border-term-muted",
                    )}
                    aria-hidden="true"
                  >
                    {checked && <Check className="size-3" strokeWidth={3} />}
                  </span>
                  <span className="min-w-0 flex-1 text-pretty leading-snug">{item.label}</span>
                  {item.hint && <span className="shrink-0 text-xs text-term-muted">{item.hint}</span>}
                  {item.more && <ChevronRight className="size-3.5 shrink-0 text-term-muted" aria-hidden="true" />}
                </button>
              )
            })}
          </div>
        ))}
      </PopoverContent>
    </Popover>
  )
}
