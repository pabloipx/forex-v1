import { setManipulations, type Manipulation } from "./multi-asset-engine"

/**
 * Sincroniza as manipulacoes ativas do servidor para o motor de precos no cliente.
 *
 * Singleton: um unico poller para toda a aba, independente de quantos graficos existirem.
 * Consulta /api/global/manipulations a cada poucos segundos e injeta no motor via
 * setManipulations(). O motor entao aplica o drift direcional determinístico — o grafico
 * e a liquidacao das operacoes (tambem client-side) passam a seguir a manipulacao.
 */
let started = false
let timer: ReturnType<typeof setInterval> | null = null

async function poll() {
  try {
    const res = await fetch("/api/global/manipulations", { cache: "no-store" })
    if (!res.ok) return
    const data = await res.json()
    setManipulations((data?.manipulations as Manipulation[]) || [])
  } catch {
    // silencioso: falha de rede nao deve travar o grafico
  }
}

export function ensureManipulationSync() {
  if (started || typeof window === "undefined") return
  started = true
  poll()
  timer = setInterval(poll, 4000)

  // Revalida imediatamente ao voltar o foco/aba.
  const onVisible = () => {
    if (!document.hidden) poll()
  }
  document.addEventListener("visibilitychange", onVisible)
  window.addEventListener("focus", onVisible)
}

export function stopManipulationSync() {
  if (timer) clearInterval(timer)
  timer = null
  started = false
}
