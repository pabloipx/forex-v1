"use client"

import { useCallback, useState, type ReactNode } from "react"
import { flushSync } from "react-dom"
import { useRouter } from "next/navigation"
import {
  Bell,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Globe,
  Lock,
  Moon,
  Shield,
  Smartphone,
  User,
  type LucideIcon,
} from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { createClient } from "@/lib/supabase/client"
import { TERM_THEME_COOKIE, type TermTheme } from "@/lib/futures/term-theme"
import { cn } from "@/lib/utils"
import { TwoFactor } from "@/components/settings/two-factor"
import { ConnectedDevices } from "@/components/settings/connected-devices"

export interface SettingsProfile {
  id: string
  email: string
  full_name: string | null
  phone: string | null
  avatar_url: string | null
}

type Section = "profile" | "password" | "2fa" | "devices" | null

export function SettingsView({ initialTheme, profile }: { initialTheme: TermTheme; profile: SettingsProfile }) {
  const router = useRouter()
  const [theme, setTheme] = useState<TermTheme>(initialTheme)
  const [section, setSection] = useState<Section>(null)
  const [notifications, setNotifications] = useState(true)
  const [savedProfile, setSavedProfile] = useState(profile)

  const toggleTheme = useCallback((dark: boolean) => {
    const next: TermTheme = dark ? "dark" : "light"
    document.cookie = `${TERM_THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`
    const apply = () => flushSync(() => setTheme(next))
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    if (!document.startViewTransition || reduceMotion) apply()
    else document.startViewTransition(apply)
  }, [])

  if (section === "2fa") return <TwoFactor onBack={() => setSection(null)} />
  if (section === "devices") return <ConnectedDevices onBack={() => setSection(null)} />

  const displayName = savedProfile.full_name?.trim() || savedProfile.email.split("@")[0]
  const initial = displayName.charAt(0).toUpperCase()

  return (
    <div
      className={cn(
        "min-h-dvh bg-term-bg font-sans text-term-text",
        theme === "light" ? "term-light" : "term-dark",
      )}
    >
      {section === "profile" ? (
        <SubPage title="Editar perfil" onBack={() => setSection(null)}>
          <ProfileForm
            profile={savedProfile}
            initial={initial}
            onSaved={(p) => {
              setSavedProfile(p)
              router.refresh()
            }}
          />
        </SubPage>
      ) : section === "password" ? (
        <SubPage title="Alterar senha" onBack={() => setSection(null)}>
          <PasswordForm onDone={() => setSection(null)} />
        </SubPage>
      ) : (
        <SubPage title="Configurações" onBack={() => router.back()}>
          <div className="flex flex-col gap-8">
            <section
              aria-label="Resumo da conta"
              className="flex items-center gap-4 rounded-xl border border-term-line bg-term-panel p-5"
            >
              <Avatar src={savedProfile.avatar_url} initial={initial} size="md" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-base font-semibold">{displayName}</span>
                <span className="truncate text-sm text-term-muted">{savedProfile.email}</span>
              </div>
              <button
                type="button"
                onClick={() => setSection("profile")}
                className="rounded-full border border-term-line px-3.5 py-1.5 text-xs font-medium transition-colors hover:bg-term-line"
              >
                Editar
              </button>
            </section>

            <Group title="Conta">
              <NavRow icon={User} label="Editar perfil" hint="Nome, foto e telefone" onClick={() => setSection("profile")} />
              <NavRow icon={Lock} label="Alterar senha" hint="Atualize sua senha de acesso" onClick={() => setSection("password")} />
            </Group>

            <Group title="Preferências">
              <ToggleRow
                icon={Bell}
                label="Notificações"
                hint="Alertas de ordens e depósitos"
                checked={notifications}
                onCheckedChange={setNotifications}
              />
              <ToggleRow
                icon={Moon}
                label="Modo escuro"
                hint="Aplica ao terminal de negociação"
                checked={theme === "dark"}
                onCheckedChange={toggleTheme}
              />
              <Row icon={Globe} label="Idioma">
                <span className="text-sm text-term-muted">Português (BR)</span>
              </Row>
            </Group>

            <Group title="Segurança">
              <NavRow
                icon={Smartphone}
                label="Verificação em duas etapas"
                hint="Adicione uma camada extra de segurança"
                onClick={() => setSection("2fa")}
              />
              <NavRow
                icon={Shield}
                label="Dispositivos conectados"
                hint="Gerencie as sessões ativas"
                onClick={() => setSection("devices")}
              />
            </Group>

            <footer className="flex flex-col items-center gap-1 pb-4 text-center">
              <span className="text-xs font-medium text-term-muted">Kryptobit v1.0.0</span>
              <span className="text-xs text-term-muted/70">© 2026 Todos os direitos reservados</span>
            </footer>
          </div>
        </SubPage>
      )}
    </div>
  )
}

function SubPage({ title, onBack, children }: { title: string; onBack: () => void; children: ReactNode }) {
  return (
    <>
      <header className="sticky top-0 z-10 border-b border-term-line bg-term-panel/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-2xl items-center gap-2 px-4">
          <button
            type="button"
            onClick={onBack}
            aria-label="Voltar"
            className="-ml-2 flex size-9 items-center justify-center rounded-full text-term-muted transition-colors hover:bg-term-line hover:text-term-text"
          >
            <ChevronLeft className="size-5" aria-hidden="true" />
          </button>
          <h1 className="text-base font-semibold">{title}</h1>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-8">{children}</main>
    </>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-term-muted">{title}</h2>
      <div className="flex flex-col divide-y divide-term-line overflow-hidden rounded-xl border border-term-line bg-term-panel">
        {children}
      </div>
    </section>
  )
}

function RowContent({ icon: Icon, label, hint }: { icon: LucideIcon; label: string; hint?: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3.5">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-col text-left">
        <span className="truncate text-sm font-medium">{label}</span>
        {hint && <span className="truncate text-xs text-term-muted">{hint}</span>}
      </span>
    </div>
  )
}

function Row({ icon, label, hint, children }: { icon: LucideIcon; label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3.5">
      <RowContent icon={icon} label={label} hint={hint} />
      {children}
    </div>
  )
}

function NavRow({ icon, label, hint, onClick }: { icon: LucideIcon; label: string; hint?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-term-line/50 focus-visible:bg-term-line/50 focus-visible:outline-none"
    >
      <RowContent icon={icon} label={label} hint={hint} />
      <ChevronRight
        className="size-4 shrink-0 text-term-muted transition-transform group-hover:translate-x-0.5"
        aria-hidden="true"
      />
    </button>
  )
}

function ToggleRow({
  icon,
  label,
  hint,
  checked,
  onCheckedChange,
}: {
  icon: LucideIcon
  label: string
  hint?: string
  checked: boolean
  onCheckedChange: (value: boolean) => void
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-term-line/50">
      <RowContent icon={icon} label={label} hint={hint} />
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-label={label}
        className="data-[state=unchecked]:bg-term-line [&_[data-slot=switch-thumb]]:bg-primary-foreground"
      />
    </label>
  )
}

function Avatar({ src, initial, size }: { src: string | null; initial: string; size: "md" | "lg" }) {
  const dim = size === "lg" ? "size-20 text-2xl" : "size-12 text-lg"
  return src ? (
    <img src={src} alt="Foto de perfil" className={cn(dim, "shrink-0 rounded-full object-cover")} />
  ) : (
    <span
      aria-hidden="true"
      className={cn(dim, "flex shrink-0 items-center justify-center rounded-full bg-primary/15 font-semibold text-primary")}
    >
      {initial}
    </span>
  )
}

const inputClass =
  "h-11 w-full rounded-lg border border-term-line bg-term-bg px-3.5 text-sm text-term-text outline-none transition-colors placeholder:text-term-muted focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:text-term-muted"

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-term-muted">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-term-muted">{hint}</p>}
    </div>
  )
}

function Feedback({ error, success }: { error: string; success: string }) {
  if (error)
    return (
      <p role="alert" className="text-center text-sm text-short">
        {error}
      </p>
    )
  if (success)
    return (
      <p role="status" className="flex items-center justify-center gap-2 text-sm text-long">
        <Check className="size-4" aria-hidden="true" />
        {success}
      </p>
    )
  return null
}

const submitClass =
  "h-11 w-full rounded-lg bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11)
  if (digits.length <= 2) return digits
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}

function ProfileForm({
  profile,
  initial,
  onSaved,
}: {
  profile: SettingsProfile
  initial: string
  onSaved: (p: SettingsProfile) => void
}) {
  const [fullName, setFullName] = useState(profile.full_name ?? "")
  const [phone, setPhone] = useState(profile.phone ?? "")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError("")
    setSuccess("")
    const { error: updateError } = await createClient()
      .from("profiles")
      .update({ full_name: fullName.trim(), phone, updated_at: new Date().toISOString() })
      .eq("id", profile.id)
    setSaving(false)
    if (updateError) return setError("Erro ao salvar perfil")
    setSuccess("Perfil atualizado")
    onSaved({ ...profile, full_name: fullName.trim(), phone })
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-3 rounded-xl border border-term-line bg-term-panel p-6">
        <Avatar src={profile.avatar_url} initial={initial} size="lg" />
        <span className="text-sm text-term-muted">{profile.email}</span>
      </div>
      <div className="flex flex-col gap-4 rounded-xl border border-term-line bg-term-panel p-5">
        <Field id="full-name" label="Nome completo">
          <input
            id="full-name"
            className={inputClass}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Seu nome"
            autoComplete="name"
          />
        </Field>
        <Field id="email" label="E-mail" hint="O e-mail não pode ser alterado">
          <input id="email" type="email" className={inputClass} value={profile.email} disabled />
        </Field>
        <Field id="phone" label="Telefone">
          <input
            id="phone"
            type="tel"
            className={inputClass}
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
            placeholder="(00) 00000-0000"
            autoComplete="tel"
            inputMode="tel"
          />
        </Field>
      </div>
      <Feedback error={error} success={success} />
      <button type="submit" disabled={saving} className={submitClass}>
        {saving ? "Salvando..." : "Salvar alterações"}
      </button>
    </form>
  )
}

function PasswordInput({
  id,
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  autoComplete: string
}) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? "text" : "password"}
        className={cn(inputClass, "pr-11")}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
        className="absolute right-1 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-term-muted hover:text-term-text"
      >
        {visible ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
      </button>
    </div>
  )
}

function PasswordForm({ onDone }: { onDone: () => void }) {
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    if (newPassword.length < 6) return setError("A senha deve ter pelo menos 6 caracteres")
    if (newPassword !== confirmPassword) return setError("As senhas não coincidem")
    setSaving(true)
    const { error: updateError } = await createClient().auth.updateUser({ password: newPassword })
    setSaving(false)
    if (updateError) return setError("Erro ao alterar senha")
    setSuccess("Senha alterada com sucesso")
    setNewPassword("")
    setConfirmPassword("")
    setTimeout(onDone, 1500)
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 rounded-xl border border-term-line bg-term-panel p-5">
        <Field id="new-password" label="Nova senha" hint="Mínimo de 6 caracteres">
          <PasswordInput
            id="new-password"
            value={newPassword}
            onChange={setNewPassword}
            placeholder="Digite sua nova senha"
            autoComplete="new-password"
          />
        </Field>
        <Field id="confirm-password" label="Confirmar nova senha">
          <PasswordInput
            id="confirm-password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            placeholder="Confirme sua nova senha"
            autoComplete="new-password"
          />
        </Field>
      </div>
      <Feedback error={error} success={success} />
      <button type="submit" disabled={saving || !newPassword || !confirmPassword} className={submitClass}>
        {saving ? "Alterando..." : "Alterar senha"}
      </button>
    </form>
  )
}
