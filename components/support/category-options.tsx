import {
  ArrowDownToLine,
  ArrowUpFromLine,
  CandlestickChart,
  ChevronRight,
  CircleHelp,
  KeyRound,
  PencilLine,
  TriangleAlert,
  UserRoundSearch,
} from "lucide-react"
import { SUPPORT_CATEGORIES, type SupportCategory } from "@/lib/support/constants"

export const CATEGORY_ICONS: Record<SupportCategory, typeof CircleHelp> = {
  saque: ArrowUpFromLine,
  deposito: ArrowDownToLine,
  erros: TriangleAlert,
  senha: KeyRound,
  recuperacao: UserRoundSearch,
  operacoes: CandlestickChart,
  outro: CircleHelp,
}

export function CategoryOptions({ onSelect }: { onSelect: (id: SupportCategory) => void }) {
  return (
    <ul className="flex flex-col gap-2 pl-9" aria-label="Assuntos">
      {SUPPORT_CATEGORIES.map((c) => {
        const Icon = CATEGORY_ICONS[c.id]
        return (
          <li key={c.id}>
            <button
              type="button"
              onClick={() => onSelect(c.id)}
              className="group flex w-full items-center gap-3 rounded-xl border border-term-line bg-term-panel px-3 py-2.5 text-left transition-colors hover:border-support/60 hover:bg-support/5 focus-visible:border-support focus-visible:outline-none"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-term-line text-term-muted transition-colors group-hover:bg-support/15 group-hover:text-support">
                <Icon className="size-4" aria-hidden="true" />
              </span>
              <span className="flex-1 text-sm font-medium">{c.label}</span>
              <ChevronRight className="size-4 text-term-muted transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </button>
          </li>
        )
      })}
    </ul>
  )
}

export function CategoryChip({ id, label }: { id: SupportCategory; label: string }) {
  const Icon = CATEGORY_ICONS[id]
  return (
    <span className="flex items-center gap-2 font-medium">
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      {label}
    </span>
  )
}

export function DescribeHint() {
  return (
    <div className="rounded-xl border border-dashed border-support/50 bg-support/5 p-4">
      <p className="flex items-center gap-2 text-sm font-semibold text-support">
        <PencilLine className="size-4" aria-hidden="true" />
        Descreva seu problema
      </p>
      <ul className="mt-2 flex flex-col gap-1 text-sm text-term-muted">
        <li>• O que aconteceu e quando</li>
        <li>• Valores envolvidos, se houver</li>
        <li>• Mensagens de erro que apareceram</li>
      </ul>
      <p className="mt-2 text-xs text-term-muted">Use o campo abaixo para escrever.</p>
    </div>
  )
}
