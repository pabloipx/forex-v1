"use client"

import { createContext, useContext, useMemo } from "react"

export type DisplayCurrency = "BRL" | "USD"

export interface DisplayPreferences {
  currency: DisplayCurrency
  /** Cotacao de 1 USD em BRL, usada para converter os valores armazenados em real */
  usd_rate: number
  /** Data exata do proximo pagamento definida pelo admin (YYYY-MM-DD) */
  next_payment_date: string | null
}

export const DEFAULT_DISPLAY: DisplayPreferences = {
  currency: "BRL",
  usd_rate: 5.4,
  next_payment_date: null,
}

const DisplayContext = createContext<DisplayPreferences>(DEFAULT_DISPLAY)

export function DisplayProvider({
  value,
  children,
}: {
  value: DisplayPreferences
  children: React.ReactNode
}) {
  return <DisplayContext.Provider value={value}>{children}</DisplayContext.Provider>
}

export function useDisplay() {
  return useContext(DisplayContext)
}

/** Cotacao segura: uma cotacao zerada ou negativa dividiria por zero */
function safeRate(rate: number) {
  return rate > 0 ? rate : DEFAULT_DISPLAY.usd_rate
}

/**
 * Conversores entre a moeda exibida e o real, que e a moeda em que os valores
 * ficam armazenados. Necessario em formularios: o afiliado digita na moeda que
 * ve na tela, mas a API sempre espera reais.
 */
export function useCurrencyConverter() {
  const { currency, usd_rate } = useDisplay()

  return useMemo(() => {
    const rate = safeRate(usd_rate)
    const isUsd = currency === "USD"

    return {
      currency,
      symbol: isUsd ? "$" : "R$",
      /** Converte um valor digitado na moeda exibida para reais */
      toBRL: (value: number) => (isUsd ? (Number(value) || 0) * rate : Number(value) || 0),
      /** Converte um valor em reais para a moeda exibida */
      fromBRL: (value: number) => (isUsd ? (Number(value) || 0) / rate : Number(value) || 0),
    }
  }, [currency, usd_rate])
}

/**
 * Formata um valor guardado em BRL na moeda escolhida pelo admin.
 * Substitui o antigo helper `brl` mantendo a mesma assinatura, para que as
 * chamadas existentes nos componentes continuem funcionando sem alteracao.
 */
export function useMoney() {
  const { currency, usd_rate } = useDisplay()

  return useMemo(() => {
    if (currency === "USD") {
      // Uma cotacao invalida dividiria por zero e exibiria Infinity
      const rate = usd_rate > 0 ? usd_rate : DEFAULT_DISPLAY.usd_rate
      const formatter = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })
      return (value: number) => formatter.format((Number(value) || 0) / rate)
    }

    const formatter = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })
    return (value: number) => formatter.format(Number(value) || 0)
  }, [currency, usd_rate])
}
