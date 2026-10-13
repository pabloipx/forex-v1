"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import {
  ChevronLeft,
  ChevronRight,
  User,
  Bell,
  Lock,
  Globe,
  Moon,
  Smartphone,
  Shield,
  Eye,
  EyeOff,
  Check,
  Camera,
} from "lucide-react"
import { TwoFactor } from "@/components/settings/two-factor"
import { ConnectedDevices } from "@/components/settings/connected-devices"

interface UserProfile {
  id: string
  email: string
  full_name: string | null
  phone: string | null
  avatar_url: string | null
}

export default function SettingsPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [activeSection, setActiveSection] = useState<string | null>(null)

  // Form states
  const [fullName, setFullName] = useState("")
  const [phone, setPhone] = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [error, setError] = useState("")

  // Settings states
  const [notifications, setNotifications] = useState(true)
  const [darkMode, setDarkMode] = useState(true)
  const [language, setLanguage] = useState("pt-BR")

  const supabase = createClient()

  useEffect(() => {
    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.replace("/auth/login")
        return
      }

      const { data: profileData } = await supabase.from("profiles").select("*").eq("id", user.id).single()

      if (profileData) {
        setProfile(profileData)
        setFullName(profileData.full_name || "")
        setPhone(profileData.phone || "")
      }

      setLoading(false)
    }

    loadProfile()
  }, [router, supabase])

  const handleSaveProfile = async () => {
    if (!profile) return

    setSaving(true)
    setError("")

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        phone: phone,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id)

    if (updateError) {
      setError("Erro ao salvar perfil")
    } else {
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    }

    setSaving(false)
  }

  const handleChangePassword = async () => {
    setError("")

    if (newPassword !== confirmPassword) {
      setError("As senhas não coincidem")
      return
    }

    if (newPassword.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres")
      return
    }

    setSaving(true)

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    })

    if (updateError) {
      setError("Erro ao alterar senha")
    } else {
      setSuccess(true)
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setTimeout(() => {
        setSuccess(false)
        setActiveSection(null)
      }, 2000)
    }

    setSaving(false)
  }

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, "")
    if (numbers.length <= 11) {
      return numbers.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3")
    }
    return value
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B0F14]">
        <div className="w-8 h-8 border-2 border-[#f97316] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // Two-Factor Authentication Section
  if (activeSection === "2fa") {
    return <TwoFactor onBack={() => setActiveSection(null)} />
  }

  // Connected Devices Section
  if (activeSection === "devices") {
    return <ConnectedDevices onBack={() => setActiveSection(null)} />
  }

  // Profile Edit Section
  if (activeSection === "profile") {
    return (
      <div className="min-h-screen bg-[#0B0F14]">
        <div className="sticky top-0 z-10 px-4 py-4 flex items-center gap-3 border-b border-[#1F2933] bg-[#0B0F14]">
          <button onClick={() => setActiveSection(null)} className="p-2 -ml-2">
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
          <h1 className="text-xl font-bold text-white">Editar Perfil</h1>
        </div>

        <div className="px-4 py-6 space-y-6">
          {/* Avatar */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="w-24 h-24 rounded-full bg-[#121826] flex items-center justify-center border-2 border-[#1F2933]">
                {profile?.avatar_url ? (
                  <img
                    src={profile.avatar_url || "/placeholder.svg"}
                    alt="Avatar"
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <User className="w-12 h-12 text-[#6B7280]" />
                )}
              </div>
              <button className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-[#f97316] flex items-center justify-center">
                <Camera className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm text-[#9CA3AF] mb-2">Nome completo</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full py-4 px-4 rounded-xl text-white bg-[#121826] border border-[#1F2933] focus:border-[#f97316] outline-none"
              placeholder="Seu nome"
            />
          </div>

          {/* Email (read-only) */}
          <div>
            <label className="block text-sm text-[#9CA3AF] mb-2">E-mail</label>
            <input
              type="email"
              value={profile?.email || ""}
              disabled
              className="w-full py-4 px-4 rounded-xl text-[#6B7280] bg-[#121826] border border-[#1F2933] cursor-not-allowed"
            />
            <p className="text-xs text-[#6B7280] mt-1">O e-mail não pode ser alterado</p>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm text-[#9CA3AF] mb-2">Telefone</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              className="w-full py-4 px-4 rounded-xl text-white bg-[#121826] border border-[#1F2933] focus:border-[#f97316] outline-none"
              placeholder="(00) 00000-0000"
            />
          </div>

          {error && <p className="text-sm text-[#EF4444] text-center">{error}</p>}

          {success && (
            <div className="flex items-center justify-center gap-2 text-[#f97316]">
              <Check className="w-5 h-5" />
              <span>Perfil atualizado!</span>
            </div>
          )}

          <button
            onClick={handleSaveProfile}
            disabled={saving}
            className="w-full py-4 rounded-xl font-semibold text-white bg-[#f97316] hover:bg-[#fb923c] disabled:opacity-50 transition-colors"
          >
            {saving ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
      </div>
    )
  }

  // Password Change Section
  if (activeSection === "password") {
    return (
      <div className="min-h-screen bg-[#0B0F14]">
        <div className="sticky top-0 z-10 px-4 py-4 flex items-center gap-3 border-b border-[#1F2933] bg-[#0B0F14]">
          <button onClick={() => setActiveSection(null)} className="p-2 -ml-2">
            <ChevronLeft className="w-6 h-6 text-white" />
          </button>
          <h1 className="text-xl font-bold text-white">Alterar Senha</h1>
        </div>

        <div className="px-4 py-6 space-y-6">
          {/* Current Password */}
          <div>
            <label className="block text-sm text-[#9CA3AF] mb-2">Senha atual</label>
            <div className="relative">
              <input
                type={showCurrentPassword ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full py-4 px-4 pr-12 rounded-xl text-white bg-[#121826] border border-[#1F2933] focus:border-[#f97316] outline-none"
                placeholder="Digite sua senha atual"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6B7280]"
              >
                {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className="block text-sm text-[#9CA3AF] mb-2">Nova senha</label>
            <div className="relative">
              <input
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full py-4 px-4 pr-12 rounded-xl text-white bg-[#121826] border border-[#1F2933] focus:border-[#f97316] outline-none"
                placeholder="Digite sua nova senha"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[#6B7280]"
              >
                {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm text-[#9CA3AF] mb-2">Confirmar nova senha</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full py-4 px-4 rounded-xl text-white bg-[#121826] border border-[#1F2933] focus:border-[#f97316] outline-none"
              placeholder="Confirme sua nova senha"
            />
          </div>

          {error && <p className="text-sm text-[#EF4444] text-center">{error}</p>}

          {success && (
            <div className="flex items-center justify-center gap-2 text-[#f97316]">
              <Check className="w-5 h-5" />
              <span>Senha alterada com sucesso!</span>
            </div>
          )}

          <button
            onClick={handleChangePassword}
            disabled={saving || !newPassword || !confirmPassword}
            className="w-full py-4 rounded-xl font-semibold text-white bg-[#f97316] hover:bg-[#fb923c] disabled:opacity-50 transition-colors"
          >
            {saving ? "Alterando..." : "Alterar senha"}
          </button>
        </div>
      </div>
    )
  }

  // Main Settings Page
  return (
    <div className="min-h-screen bg-[#0B0F14]">
      <div className="sticky top-0 z-10 px-4 py-4 flex items-center gap-3 border-b border-[#1F2933] bg-[#0B0F14]">
        <button onClick={() => router.back()} className="p-2 -ml-2">
          <ChevronLeft className="w-6 h-6 text-white" />
        </button>
        <h1 className="text-xl font-bold text-white">Configurações</h1>
      </div>

      <div className="px-4 py-6 space-y-6">
        {/* Account Section */}
        <div>
          <h2 className="text-sm font-semibold text-[#9CA3AF] mb-3 uppercase tracking-wider">Conta</h2>
          <div className="space-y-2">
            <button
              onClick={() => setActiveSection("profile")}
              className="w-full p-4 rounded-xl flex items-center justify-between bg-[#121826]"
            >
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-[#f97316]" />
                <div className="text-left">
                  <span className="text-white block">Editar perfil</span>
                  <span className="text-xs text-[#6B7280]">Nome, foto, telefone</span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-[#6B7280]" />
            </button>

            <button
              onClick={() => setActiveSection("password")}
              className="w-full p-4 rounded-xl flex items-center justify-between bg-[#121826]"
            >
              <div className="flex items-center gap-3">
                <Lock className="w-5 h-5 text-[#f97316]" />
                <div className="text-left">
                  <span className="text-white block">Alterar senha</span>
                  <span className="text-xs text-[#6B7280]">Segurança da conta</span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-[#6B7280]" />
            </button>
          </div>
        </div>

        {/* Preferences Section */}
        <div>
          <h2 className="text-sm font-semibold text-[#9CA3AF] mb-3 uppercase tracking-wider">Preferências</h2>
          <div className="space-y-2">
            <div className="p-4 rounded-xl flex items-center justify-between bg-[#121826]">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-[#9CA3AF]" />
                <span className="text-white">Notificações</span>
              </div>
              <button
                onClick={() => setNotifications(!notifications)}
                className={`w-12 h-6 rounded-full transition-colors ${notifications ? "bg-[#f97316]" : "bg-[#374151]"}`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform ${notifications ? "translate-x-6" : "translate-x-1"}`}
                />
              </button>
            </div>

            <div className="p-4 rounded-xl flex items-center justify-between bg-[#121826]">
              <div className="flex items-center gap-3">
                <Moon className="w-5 h-5 text-[#9CA3AF]" />
                <span className="text-white">Modo escuro</span>
              </div>
              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`w-12 h-6 rounded-full transition-colors ${darkMode ? "bg-[#f97316]" : "bg-[#374151]"}`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform ${darkMode ? "translate-x-6" : "translate-x-1"}`}
                />
              </button>
            </div>

            <div className="p-4 rounded-xl flex items-center justify-between bg-[#121826]">
              <div className="flex items-center gap-3">
                <Globe className="w-5 h-5 text-[#9CA3AF]" />
                <span className="text-white">Idioma</span>
              </div>
              <span className="text-sm text-[#9CA3AF]">Português</span>
            </div>
          </div>
        </div>

        {/* Security Section */}
        <div>
          <h2 className="text-sm font-semibold text-[#9CA3AF] mb-3 uppercase tracking-wider">Segurança</h2>
          <div className="space-y-2">
            <button
              onClick={() => setActiveSection("2fa")}
              className="w-full p-4 rounded-xl flex items-center justify-between bg-[#121826] hover:bg-[#1A2332] transition-colors"
            >
              <div className="flex items-center gap-3">
                <Smartphone className="w-5 h-5 text-[#9CA3AF]" />
                <div className="text-left">
                  <span className="text-white block">Verificação em duas etapas</span>
                  <span className="text-xs text-[#6B7280]">Adicione uma camada extra de segurança</span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-[#6B7280]" />
            </button>

            <button
              onClick={() => setActiveSection("devices")}
              className="w-full p-4 rounded-xl flex items-center justify-between bg-[#121826] hover:bg-[#1A2332] transition-colors"
            >
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-[#9CA3AF]" />
                <div className="text-left">
                  <span className="text-white block">Dispositivos conectados</span>
                  <span className="text-xs text-[#6B7280]">Gerencie seus dispositivos</span>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-[#6B7280]" />
            </button>
          </div>
        </div>

        {/* App Info */}
        <div className="pt-6 text-center">
          <p className="text-sm text-[#6B7280]">URYN BROKER v1.0.0</p>
          <p className="text-xs text-[#4B5563] mt-1">© 2026 Todos os direitos reservados</p>
        </div>
      </div>
    </div>
  )
}
