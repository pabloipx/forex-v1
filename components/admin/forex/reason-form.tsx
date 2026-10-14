"use client"

import { useState } from "react"
import { SmallButton, inputCls } from "./ui"

export function ReasonForm({
  placeholder,
  busy,
  onSubmit,
  onCancel,
}: {
  placeholder: string
  busy: boolean
  onSubmit: (reason: string) => void
  onCancel: () => void
}) {
  const [reason, setReason] = useState("")
  return (
    <form
      className="flex items-center gap-1.5"
      onSubmit={(e) => {
        e.preventDefault()
        if (reason.trim()) onSubmit(reason.trim())
      }}
    >
      <label className="sr-only" htmlFor="reject-reason">
        Motivo da rejeição
      </label>
      <input
        id="reject-reason"
        autoFocus
        value={reason}
        maxLength={300}
        onChange={(e) => setReason(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onCancel()}
        placeholder={placeholder}
        className={`${inputCls} h-7 w-56 font-sans text-xs`}
      />
      <SmallButton type="submit" tone="down" disabled={busy || !reason.trim()}>
        Confirmar
      </SmallButton>
      <SmallButton onClick={onCancel}>Voltar</SmallButton>
    </form>
  )
}
