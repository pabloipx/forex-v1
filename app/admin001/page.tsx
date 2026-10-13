"use client"

import type React from "react"
import { useState } from "react"
import { Eye, EyeOff, Lock, Mail } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import Image from "next/image"

// As credenciais do painel ficam apenas no servidor, nas variaveis de ambiente
// ADMIN_EMAIL e ADMIN_PASSWORD. Antes elas estavam escritas neste arquivo, que e um
// componente de cliente: qualquer visitante conseguia le-las no bundle do navegador e,
// com elas, chamar as rotas /api/admin que acessam o banco ignorando o RLS.
export default function AdminLoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json().catch(() => ({}))

      if (res.ok && data?.success) {
        // A sessao vive em um cookie HttpOnly definido pelo servidor. Antes de sair
        // desta pagina confirmamos que o cookie realmente foi gravado: se o navegador
        // o descartar (bloqueio de cookies de terceiros quando a pagina roda dentro de
        // um iframe de outro dominio, por exemplo), o dashboard devolveria o usuario
        // para ca sem qualquer mensagem, dando a impressao de "entra e sai".
        const session = await fetch("/api/admin/session", { cache: "no-store" })
          .then((r) => r.json())
          .catch(() => null)

        if (session?.authenticated) {
          window.location.href = "/admin/dashboard"
          return
        }

        setError(
          "Login aceito, mas o navegador nao guardou o cookie da sessao. Abra o painel em uma aba propria (fora do preview incorporado) ou libere os cookies deste site.",
        )
        return
      }

      setError(data?.error || "Email ou senha incorretos")
    } catch {
      setError("Nao foi possivel conectar ao servidor")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0B0F14] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Image
            src="/images/uryn-fox-logo.png"
            alt="URYNBROKER"
            width={240}
            height={64}
            priority
            className="mx-auto mb-4 h-auto w-[240px]"
          />
          <h1 className="text-2xl font-bold text-white">Painel Administrativo</h1>
          <p className="text-gray-400 mt-2">Digite suas credenciais para acessar</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <Input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 h-12 bg-[#1A1F2E] border-[#2A3142] text-white placeholder:text-gray-500"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="Senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 pr-10 h-12 bg-[#1A1F2E] border-[#2A3142] text-white placeholder:text-gray-500"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          {error && <p className="text-red-500 text-sm text-center">{error}</p>}

          <Button
            type="submit"
            disabled={isLoading || !email || !password}
            className="w-full h-12 bg-gradient-to-r from-[#f97316] to-[#fb923c] hover:from-[#c2410c] hover:to-[#f97316] text-white font-semibold"
          >
            {isLoading ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </div>
    </div>
  )
}
