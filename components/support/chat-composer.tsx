"use client"

import { useEffect, useRef, useState } from "react"
import { Loader2, SendHorizontal } from "lucide-react"
import { SUPPORT_MESSAGE_MAX } from "@/lib/support/constants"
import { cn } from "@/lib/utils"

interface ChatComposerProps {
  placeholder: string
  onSend: (message: string) => Promise<void>
  disabled?: boolean
  highlight?: boolean
}

export function ChatComposer({ placeholder, onSend, disabled, highlight }: ChatComposerProps) {
  const [value, setValue] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const canSend = value.trim().length > 0 && !sending && !disabled

  useEffect(() => {
    if (highlight && !disabled) inputRef.current?.focus()
  }, [highlight, disabled])

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
      className="shrink-0 border-t border-term-line bg-term-bg px-3 py-3 sm:px-4"
      onSubmit={(e) => {
        e.preventDefault()
        submit()
      }}
    >
      <div className="flex items-end gap-2">
        <label htmlFor="support-message" className="sr-only">
          Mensagem
        </label>
        <textarea
          id="support-message"
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              if (e.nativeEvent.isComposing || e.keyCode === 229) return
              e.preventDefault()
              submit()
            }
          }}
          rows={1}
          maxLength={SUPPORT_MESSAGE_MAX}
          disabled={disabled}
          placeholder={placeholder}
          className={cn(
            "max-h-40 min-h-11 flex-1 resize-none rounded-xl border bg-term-panel px-4 py-2.5 text-sm leading-relaxed text-term-text outline-none transition-colors placeholder:text-term-muted disabled:cursor-not-allowed disabled:opacity-60",
            highlight && !disabled ? "border-support" : "border-term-line focus:border-support/70",
          )}
        />
        <button
          type="submit"
          disabled={!canSend}
          aria-label="Enviar mensagem"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-support text-support-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          {sending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <SendHorizontal className="size-4" aria-hidden="true" />}
        </button>
      </div>
      {error ? (
        <p role="alert" className="mt-1.5 px-1 text-xs text-term-down">
          {error}
        </p>
      ) : null}
    </form>
  )
}
