"use client"

import { SquareArrowOutUpRight, Wallet, X } from "lucide-react"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { fmtUsd, type InvestRates } from "@/lib/invest-schedule"
import { investFontVars } from "@/lib/invest-fonts"
import { cn } from "@/lib/utils"
import { InvestSimulator } from "../invest-simulator"

const isApplying = () => typeof document !== "undefined" && Boolean(document.querySelector("[data-invest-applying]"))

export default function InvestDialog({
  open,
  onOpenChange,
  authenticated,
  balance,
  rates,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  authenticated: boolean
  balance?: number
  rates?: InvestRates
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        onInteractOutside={(e) => {
          if (isApplying()) e.preventDefault()
        }}
        onEscapeKeyDown={(e) => {
          if (isApplying()) e.preventDefault()
        }}
        className={cn(
          investFontVars,
          "iv-theme flex max-h-[90dvh] w-full max-w-3xl flex-col sm:max-w-3xl gap-0 overflow-hidden rounded-2xl border border-iv-line/80 bg-iv-card p-0 font-sans text-iv-ink shadow-[0_40px_80px_-20px_rgb(0_0_0/0.8),0_0_0_1px_rgb(61_180_255/0.06)]",
          "max-sm:top-auto max-sm:bottom-0 max-sm:max-h-[94dvh] max-sm:max-w-none max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-3xl",
        )}
      >
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-iv-sky/60 to-transparent" />
        <span aria-hidden className="mx-auto mt-2.5 h-1 w-10 rounded-full bg-iv-line sm:hidden" />

        <header className="flex items-start gap-4 px-5 pb-5 pt-4 sm:px-6 sm:pt-6">
          <span className="iv-btn flex size-12 shrink-0 items-center justify-center rounded-xl">
            <SquareArrowOutUpRight className="size-5 text-iv-ink" aria-hidden />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <DialogTitle className="text-xl font-bold tracking-tight text-iv-ink">Aportar na carteira</DialogTitle>
            <DialogDescription className="text-sm text-iv-muted">
              Escolha o ativo e o valor. O rendimento cai todo dia 30.
            </DialogDescription>
          </div>
          {authenticated && balance !== undefined && (
            <span className="hidden items-center gap-2 rounded-xl border border-iv-line/80 bg-iv-bg/60 px-3 py-2 sm:flex">
              <Wallet className="size-4 text-iv-sky" aria-hidden />
              <span className="flex flex-col leading-tight">
                <span className="text-[11px] text-iv-muted">Saldo disponível</span>
                <span className="iv-num text-sm font-bold text-iv-ink">{fmtUsd(balance)}</span>
              </span>
            </span>
          )}
          <DialogClose
            aria-label="Fechar"
            className="-mr-1 flex size-10 shrink-0 items-center justify-center rounded-full text-iv-muted transition-colors hover:bg-iv-line/50 hover:text-iv-ink"
          >
            <X className="size-5" />
          </DialogClose>
        </header>

        {authenticated && balance !== undefined && (
          <div className="mx-5 mb-4 flex items-center justify-between rounded-xl border border-iv-line/80 bg-iv-bg/60 px-3 py-2 sm:hidden">
            <span className="flex items-center gap-2 text-xs text-iv-muted">
              <Wallet className="size-4 text-iv-sky" aria-hidden /> Saldo disponível
            </span>
            <span className="iv-num text-sm font-bold text-iv-ink">{fmtUsd(balance)}</span>
          </div>
        )}

        <InvestSimulator
          authenticated={authenticated}
          balance={balance}
          rates={rates}
          onInvested={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}
