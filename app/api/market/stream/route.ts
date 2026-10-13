import type { NextRequest } from "next/server"
import { subscribeLive, liveSource } from "@/lib/price-engine/live-bridge"
import { isRealSymbol } from "@/lib/price-engine/real-price-store"

export const runtime = "nodejs"
// A ponte de WebSocket precisa viver entre requisicoes; sem isso cada conexao recomecaria do zero.
export const dynamic = "force-dynamic"

/**
 * Fluxo de preco ao vivo (SSE) para um simbolo de mercado aberto.
 *
 * O navegador NAO fala com a Twelve Data diretamente: a chave da API ficaria exposta no cliente e
 * o limite de 8 creditos de WebSocket estouraria no segundo usuario. Aqui o servidor mantem uma
 * unica conexao upstream (ver live-bridge) e repassa os ticks para todos os assinantes.
 */
export async function GET(req: NextRequest) {
  const symbol = (req.nextUrl.searchParams.get("symbol") || "").toUpperCase()

  if (!isRealSymbol(symbol)) {
    return new Response("simbolo nao e de mercado aberto", { status: 400 })
  }

  const encoder = new TextEncoder()
  let unsubscribe: (() => void) | null = null
  let heartbeat: ReturnType<typeof setInterval> | null = null

  const stream = new ReadableStream({
    start(controller) {
      let closed = false
      const send = (event: string, data: unknown) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        } catch {
          closed = true
        }
      }

      const cleanup = () => {
        if (closed) return
        closed = true
        unsubscribe?.()
        if (heartbeat) clearInterval(heartbeat)
        try {
          controller.close()
        } catch {}
      }

      unsubscribe = subscribeLive(symbol, (price, atMs) => {
        send("price", { symbol, price, at: atMs, source: liveSource(symbol) })
      })

      // Comentario periodico para o navegador (e qualquer proxy no caminho) nao encerrar a
      // conexao por inatividade quando o mercado esta lento.
      heartbeat = setInterval(() => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(": ping\n\n"))
        } catch {
          cleanup()
        }
      }, 15_000)

      // Encerra e libera o ouvinte quando a aba fecha ou o usuario troca de ativo.
      req.signal.addEventListener("abort", cleanup)
    },
    cancel() {
      unsubscribe?.()
      if (heartbeat) clearInterval(heartbeat)
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Evita que proxies acumulem o fluxo em buffer e atrasem os ticks.
      "X-Accel-Buffering": "no",
    },
  })
}
