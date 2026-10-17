"use client"

import { useState } from "react"
import { Loader2, SendHorizontal } from "lucide-react"
import { SUPPORT_MESSAGE_MAX } from "@/lib/support/constants"
import { cn } from "@/lib/utils"

interface MessageComposerProps {
  placeholder: string
  onSend: (message: string) => Promise<void>
  disabled?: boolean
  autoFocus?: boolean
  rows?: number
  className?: string
}

export function MessageComposer({ placeholder, onSend, disabled, autoFocus, rows = 1, className }: MessageComposerProps) {
  const [value, setValue] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canSend = value.trim().length > 0 && !sending && !disabled

  async function submit() {
    if (!canSend) return
    setSending(true)
    setError(null)
    try {
      await onSend(value.trim())
      setValue("")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao enviar")
    } finally {
      setSending(false)
    }
  }

  return (
    <form
      className={cn("flex flex-col gap-1.5", className)}
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <div className="flex items-end gap-2 rounded-xl border border-term-line bg-term-bg p-2 focus-within:border-primary/60">
        <label htmlFor="support-message" className="sr-only">
          Mensagem
        </label>
        <textarea
          id="support-message"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              if (e.nativeEvent.isComposing || e.keyCode === 229) return
              e.preventDefault()
              submit()
            }
          }}
          rows={rows}
          maxLength={SUPPORT_MESSAGE_MAX}
          autoFocus={autoFocus}
          disabled={disabled}
          placeholder={placeholder}
          className="max-h-40 min-h-9 flex-1 resize-none bg-transparent px-2 py-1.5 text-sm leading-relaxed text-term-text outline-none placeholder:text-term-muted disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!canSend}
          aria-label="Enviar mensagem"
          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
        >
          {sending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <SendHorizontal className="size-4" aria-hidden="true" />}
        </button>
      </div>
      {error ? (
        <p role="alert" className="px-1 text-xs text-term-down">
          {error}
        </p>
      ) : null}
    </form>
  )
}
