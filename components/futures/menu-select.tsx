"use client"

import { useState } from "react"
import { ChevronDown } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

interface MenuSelectProps<T extends string> {
  value: T
  options: readonly (readonly [T, string])[]
  onChange: (v: T) => void
  label: string
  className?: string
  display?: (v: T, text: string) => React.ReactNode
}

export function MenuSelect<T extends string>({ value, options, onChange, label, className, display }: MenuSelectProps<T>) {
  const [open, setOpen] = useState(false)
  const current = options.find(([k]) => k === value)?.[1] ?? value
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className={cn(
            "flex shrink-0 items-center gap-1.5 text-[13px] font-semibold text-term-text outline-none hover:text-term-accent",
            className,
          )}
        >
          {display ? display(value, current) : current}
          <ChevronDown className={cn("size-3.5 text-term-muted transition-transform", open && "rotate-180")} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={6} className="w-auto min-w-32 border-term-line bg-term-panel p-1 text-term-text">
        <ul role="listbox" aria-label={label} className="flex flex-col">
          {options.map(([k, text]) => (
            <li key={k}>
              <button
                type="button"
                role="option"
                aria-selected={k === value}
                onClick={() => {
                  onChange(k)
                  setOpen(false)
                }}
                className={cn(
                  "w-full rounded-sm px-3 py-2 text-center text-[13px] font-medium hover:bg-term-field",
                  k === value ? "font-semibold text-term-accent" : "text-term-text",
                )}
              >
                {text}
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
