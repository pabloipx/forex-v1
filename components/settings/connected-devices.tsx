"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { getDeviceId, recordDeviceSession } from "@/lib/device-session"
import { ChevronLeft, Loader2, Monitor, Smartphone, Trash2, ShieldCheck } from "lucide-react"

interface Props {
  onBack: () => void
}

interface Session {
  id: string
  device_id: string
  device_name: string | null
  browser: string | null
  os: string | null
  last_seen: string
  created_at: string
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return "agora mesmo"
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h} h`
  const d = Math.floor(h / 24)
  return `há ${d} ${d === 1 ? "dia" : "dias"}`
}

export function ConnectedDevices({ onBack }: Props) {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [sessions, setSessions] = useState<Session[]>([])
  const [error, setError] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const currentDeviceId = typeof window !== "undefined" ? getDeviceId() : ""

  const load = async () => {
    setLoading(true)
    // Garante que o dispositivo atual esteja registrado antes de listar.
    await recordDeviceSession()
    const { data, error } = await supabase
      .from("login_sessions")
      .select("id, device_id, device_name, browser, os, last_seen, created_at")
      .order("last_seen", { ascending: false })
    if (error) setError(error.message)
    else setSessions((data || []) as Session[])
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const removeSession = async (s: Session) => {
    setRemovingId(s.id)
    setError(null)
    const { error } = await supabase.from("login_sessions").delete().eq("id", s.id)
    if (error) {
      setError(error.message)
      setRemovingId(null)
      return
    }
    // Se o usuário encerrou o dispositivo atual, faz logout de fato.
    if (s.device_id === currentDeviceId) {
      await supabase.auth.signOut()
      window.location.href = "/auth/login"
      return
    }
    setRemovingId(null)
    await load()
  }

  return (
    <div className="min-h-screen bg-[#0B0F14]">
      <div className="sticky top-0 z-10 px-4 py-4 flex items-center gap-3 border-b border-[#1F2933] bg-[#0B0F14]">
        <button onClick={onBack} className="p-2 -ml-2" aria-label="Voltar">
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>
        <h1 className="text-xl font-bold text-white">Dispositivos conectados</h1>
      </div>

      <div className="px-4 py-6 max-w-xl mx-auto space-y-4">
        {error && (
          <div className="text-sm p-3 rounded-lg text-red-400 bg-red-500/10 border border-red-500/20">{error}</div>
        )}

        <p className="text-sm text-[#9CA3AF]">
          Estes são os dispositivos que acessaram sua conta. Você pode encerrar qualquer sessão que não reconheça.
        </p>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-6 h-6 text-[#f97316] animate-spin" />
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-center text-[#6B7280] py-10">Nenhum dispositivo registrado ainda.</p>
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => {
              const isMobile = /Celular|Android|iOS/i.test(`${s.device_name} ${s.os}`)
              const isCurrent = s.device_id === currentDeviceId
              const Icon = isMobile ? Smartphone : Monitor
              return (
                <div
                  key={s.id}
                  className="p-4 rounded-xl flex items-center justify-between gap-3 bg-[#121826] border border-[#1F2933]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-lg bg-[#1A2332] flex items-center justify-center shrink-0">
                      <Icon className="w-5 h-5 text-[#9CA3AF]" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-medium truncate">{s.browser || "Navegador"}</span>
                        {isCurrent && (
                          <span className="flex items-center gap-1 text-[10px] font-semibold text-[#00E676] bg-[#00E676]/10 px-1.5 py-0.5 rounded-full shrink-0">
                            <ShieldCheck className="w-3 h-3" />
                            Este dispositivo
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#6B7280] truncate">
                        {s.device_name || s.os} · Ativo {timeAgo(s.last_seen)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeSession(s)}
                    disabled={removingId === s.id}
                    aria-label="Encerrar sessão"
                    className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50 shrink-0"
                  >
                    {removingId === s.id ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Trash2 className="w-5 h-5" />
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
