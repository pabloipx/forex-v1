"use client"

import { useSyncExternalStore } from "react"
import { subscribeLivePrice, getLivePrice } from "@/lib/price-engine/live-price-store"

/**
 * Exibe o preço vivo do ativo selecionado assinando o store de preço diretamente.
 *
 * É um componente-folha de propósito: ele (e só ele) re-renderiza a ~5x/s quando o preço muda,
 * em vez de forçar a página inteira de trade a reconciliar. É isso que mantém os cliques/toques
 * responsivos enquanto o preço continua atualizando ao vivo.
 */
export function LivePriceText({ decimals, className }: { decimals: number; className?: string }) {
  const price = useSyncExternalStore(subscribeLivePrice, getLivePrice, () => 0)

  const text =
    price > 0
      ? price.toLocaleString("en-US", {
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        })
      : "..."

  return <span className={className}>{text}</span>
}
