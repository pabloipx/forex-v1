"use client"

import { useState } from "react"
import { Save } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"

interface AdminSettingsProps {
  section: string
}

export function AdminSettings({ section }: AdminSettingsProps) {
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const getSectionTitle = () => {
    switch (section) {
      case "plataforma":
        return "Configurações da Plataforma"
      case "pagamentos":
        return "Métodos de Pagamento"
      case "landpage":
        return "Configurações da Landpage"
      case "seguranca":
        return "Segurança"
      default:
        return "Configurações"
    }
  }

  const renderSettings = () => {
    switch (section) {
      case "plataforma":
        return (
          <div className="space-y-6">
            <div className="bg-adm-surface border border-adm-line rounded-xl p-6">
              <h3 className="text-lg font-semibold text-adm-fg mb-4">Configurações Gerais</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-adm-muted mb-2">Nome da Plataforma</label>
                  <Input defaultValue="Kryptobit" className="bg-adm-elevated border-adm-line text-adm-fg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-adm-muted mb-2">Email de Suporte</label>
                  <Input defaultValue="suporte@atlasinvest.com" className="bg-adm-elevated border-adm-line text-adm-fg" />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-adm-fg font-medium">Modo Manutenção</p>
                    <p className="text-adm-muted text-sm">Desabilita o acesso à plataforma</p>
                  </div>
                  <Switch />
                </div>
              </div>
            </div>

            <div className="bg-adm-surface border border-adm-line rounded-xl p-6">
              <h3 className="text-lg font-semibold text-adm-fg mb-4">Trading</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-adm-muted mb-2">Payout Padrão (%)</label>
                  <Input type="number" defaultValue="85" className="bg-adm-elevated border-adm-line text-adm-fg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-adm-muted mb-2">Investimento Mínimo (R$)</label>
                  <Input type="number" defaultValue="1" className="bg-adm-elevated border-adm-line text-adm-fg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-adm-muted mb-2">Investimento Máximo (R$)</label>
                  <Input type="number" defaultValue="10000" className="bg-adm-elevated border-adm-line text-adm-fg" />
                </div>
              </div>
            </div>
          </div>
        )

      case "pagamentos":
        return (
          <div className="space-y-6">
            <div className="bg-adm-surface border border-adm-line rounded-xl p-6">
              <h3 className="text-lg font-semibold text-adm-fg mb-4">PIX</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-adm-fg font-medium">PIX Ativado</p>
                    <p className="text-adm-muted text-sm">Permite depósitos e saques via PIX</p>
                  </div>
                  <Switch defaultChecked />
                </div>
                <div>
                  <label className="block text-sm font-medium text-adm-muted mb-2">Chave PIX (Recebimento)</label>
                  <Input placeholder="Digite a chave PIX" className="bg-adm-elevated border-adm-line text-adm-fg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-adm-muted mb-2">Depósito Mínimo (R$)</label>
                  <Input type="number" defaultValue="10" className="bg-adm-elevated border-adm-line text-adm-fg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-adm-muted mb-2">Saque Mínimo (R$)</label>
                  <Input type="number" defaultValue="20" className="bg-adm-elevated border-adm-line text-adm-fg" />
                </div>
              </div>
            </div>
          </div>
        )

      case "seguranca":
        return (
          <div className="space-y-6">
            <div className="bg-adm-surface border border-adm-line rounded-xl p-6">
              <h3 className="text-lg font-semibold text-adm-fg mb-4">Alterar Senha Admin</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-adm-muted mb-2">Senha Atual</label>
                  <Input type="password" className="bg-adm-elevated border-adm-line text-adm-fg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-adm-muted mb-2">Nova Senha</label>
                  <Input type="password" className="bg-adm-elevated border-adm-line text-adm-fg" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-adm-muted mb-2">Confirmar Nova Senha</label>
                  <Input type="password" className="bg-adm-elevated border-adm-line text-adm-fg" />
                </div>
              </div>
            </div>
          </div>
        )

      default:
        return (
          <div className="bg-adm-surface border border-adm-line rounded-xl p-6">
            <p className="text-adm-muted">Configurações em desenvolvimento...</p>
          </div>
        )
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-adm-fg">{getSectionTitle()}</h1>
          <p className="text-adm-muted mt-1">Ajuste as configurações da plataforma</p>
        </div>
        <Button onClick={handleSave} className="bg-adm-accent hover:bg-adm-accent-strong">
          <Save className="w-4 h-4 mr-2" />
          {saved ? "Salvo!" : "Salvar"}
        </Button>
      </div>

      {renderSettings()}
    </div>
  )
}
