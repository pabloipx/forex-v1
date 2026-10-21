"use client"

import { useRef, useState, type ReactNode } from "react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface HintPopoverProps {
  label: ReactNode
  children: ReactNode
}

export function HintPopover({ label, children }: HintPopoverProps) {
  const [open, setOpen] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
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
    closeTimer.current = setTimeout(() => setOpen(false), 120)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        onPointerEnter={openOnHover}
        onPointerLeave={closeOnLeave}
        className="-my-2 flex min-h-11 items-center underline decoration-term-muted/60 decoration-dashed underline-offset-4"
      >
        {label}
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={6}
        collisionPadding={8}
        onPointerEnter={openOnHover}
        onPointerLeave={closeOnLeave}
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="w-[min(20rem,calc(100vw-1rem))] border-term-line bg-term-panel p-3 text-[13px] leading-relaxed font-normal text-term-text shadow-xl"
      >
        {children}
      </PopoverContent>
    </Popover>
  )
}
