import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { password } = await request.json()

    // Senha de ativacao do Robo KAYKO (validada no servidor para nao ficar exposta no bundle).
    const VALID_PASSWORD = "KAYKO$775"

    if (!password || typeof password !== "string") {
      return NextResponse.json({ success: false, error: "Digite a senha do robô" }, { status: 400 })
    }

    if (password.trim() !== VALID_PASSWORD) {
      return NextResponse.json({ success: false, error: "Senha incorreta" }, { status: 401 })
    }

    return NextResponse.json({ success: true, message: "Robô ativado com sucesso" })
  } catch {
    return NextResponse.json({ success: false, error: "Erro interno do servidor" }, { status: 500 })
  }
}
