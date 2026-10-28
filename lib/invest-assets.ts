export const INVEST_ASSET_IDS = ["USD", "CHF", "JPY", "EUR", "XAU", "XAG", "US10Y", "US02Y", "SGOV", "SHY"] as const

export type InvestAssetId = (typeof INVEST_ASSET_IDS)[number]

export type InvestAssetGroup = "moedas" | "metais" | "tesouro"

export interface InvestAsset {
  id: InvestAssetId
  name: string
  ticker: string
  category: string
  group: InvestAssetGroup
  glyph: string
}

export const INVEST_ASSETS: InvestAsset[] = [
  { id: "USD", name: "Dólar americano", ticker: "USD", category: "Moeda de reserva", group: "moedas", glyph: "$" },
  { id: "CHF", name: "Franco suíço", ticker: "CHF", category: "Moeda de refúgio", group: "moedas", glyph: "₣" },
  { id: "JPY", name: "Iene japonês", ticker: "JPY", category: "Moeda de refúgio", group: "moedas", glyph: "¥" },
  { id: "EUR", name: "Euro", ticker: "EUR", category: "Moeda de reserva", group: "moedas", glyph: "€" },
  { id: "XAU", name: "Ouro", ticker: "XAU/USD", category: "Metal precioso", group: "metais", glyph: "Au" },
  { id: "XAG", name: "Prata", ticker: "XAG/USD", category: "Metal precioso", group: "metais", glyph: "Ag" },
  { id: "US10Y", name: "Tesouro americano 10 anos", ticker: "US10Y", category: "Títulos públicos", group: "tesouro", glyph: "10Y" },
  { id: "US02Y", name: "Tesouro americano 2 anos", ticker: "US02Y", category: "Títulos públicos", group: "tesouro", glyph: "2Y" },
  { id: "SGOV", name: "ETF Tesouro curto prazo", ticker: "SGOV", category: "ETF de renda fixa", group: "tesouro", glyph: "SG" },
  { id: "SHY", name: "ETF Tesouro 1 a 3 anos", ticker: "SHY", category: "ETF de renda fixa", group: "tesouro", glyph: "SH" },
]

export const INVEST_ASSET_GROUPS: { id: InvestAssetGroup; label: string }[] = [
  { id: "moedas", label: "Moedas" },
  { id: "metais", label: "Metais" },
  { id: "tesouro", label: "Tesouro" },
]

export const getInvestAsset = (id: string | null | undefined): InvestAsset =>
  INVEST_ASSETS.find((a) => a.id === id) ?? INVEST_ASSETS[0]
