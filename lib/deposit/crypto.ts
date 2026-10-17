export type CryptoType = "usdt" | "btc" | "eth" | "sol"

export interface CryptoOption {
  id: CryptoType
  symbol: string
  name: string
  glyph: string
  network: string
  wallet: string
  color: string
}

export const CRYPTO_OPTIONS: Record<CryptoType, CryptoOption> = {
  usdt: {
    id: "usdt",
    symbol: "USDT",
    name: "Tether",
    glyph: "₮",
    network: "ERC-20",
    wallet: "0x62DA8449C0F7e52c39678117ce85676c4167B9A6",
    color: "#26A17B",
  },
  btc: {
    id: "btc",
    symbol: "BTC",
    name: "Bitcoin",
    glyph: "₿",
    network: "BTC",
    wallet: "bc1ql64v7038ma56azlwr0shhsrc9g7pg3fr4ndrpd",
    color: "#F7931A",
  },
  eth: {
    id: "eth",
    symbol: "ETH",
    name: "Ethereum",
    glyph: "Ξ",
    network: "ETH",
    wallet: "0x62DA8449C0F7e52c39678117ce85676c4167B9A6",
    color: "#627EEA",
  },
  sol: {
    id: "sol",
    symbol: "SOL",
    name: "Solana",
    glyph: "S",
    network: "SOL",
    wallet: "97uR4DUUgsaBR3D6wBkidsEfyY2Xy4oGvD22CWnQAuFm",
    color: "#9945FF",
  },
}

export const CRYPTO_LIST = Object.values(CRYPTO_OPTIONS)

export const CRYPTO_MIN_USD = 20
export const USD_TO_BRL = 6.0

export function isCryptoType(value: unknown): value is CryptoType {
  return typeof value === "string" && value in CRYPTO_OPTIONS
}
