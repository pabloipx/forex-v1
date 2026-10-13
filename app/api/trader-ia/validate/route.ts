import { NextResponse } from "next/server"

export async function POST(request: Request) {
  try {
    const { code } = await request.json()

    // Validação do código no backend
    const VALID_CODE = "supravip"

    if (!code || typeof code !== "string") {
      return NextResponse.json({ success: false, error: "Código inválido" }, { status: 400 })
    }

    if (code.toLowerCase().trim() !== VALID_CODE) {
      return NextResponse.json({ success: false, error: "Código de acesso incorreto" }, { status: 401 })
    }

    return NextResponse.json({
      success: true,
      message: "Código validado com sucesso",
      ia: {
        id: "supra-indicador",
        name: "Supra Indicador",
        logo: "https://i.postimg.cc/cLQrNnzv/IMG-7296.png",
        icon: "https://i.postimg.cc/PJ42cJjf/IMG-7295.png",
      },
    })
  } catch (error) {
    return NextResponse.json({ success: false, error: "Erro interno do servidor" }, { status: 500 })
  }
}
