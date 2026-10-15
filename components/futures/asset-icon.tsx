"use client"

import { memo, useState } from "react"
import { cn } from "@/lib/utils"
import type { FuturesMarket } from "@/lib/futures/markets"

const CRYPTO_CDN = "https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/svg/color"
const FLAG_CDN = "https://flagcdn.com"

const CURRENCY_FLAG: Record<string, string> = {
  USD: "us",
  EUR: "eu",
  GBP: "gb",
  AUD: "au",
  NZD: "nz",
  JPY: "jp",
  CAD: "ca",
  CHF: "ch",
  BRL: "br",
}

const METAL_STYLE: Record<string, { label: string; className: string }> = {
  XAU: { label: "Au", className: "bg-[#E9B949] text-[#5A3E00] ring-[#C99A2E]" },
  XAG: { label: "Ag", className: "bg-[#C9CED6] text-[#3A3F47] ring-[#A8AEB8]" },
}

function Fallback({ text, className }: { text: string; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-primary/15 font-bold text-primary",
        className,
      )}
    >
      {text}
    </span>
  )
}

function RoundImage({ src, alt, size, fallback, className }: { src: string; alt: string; size: number; fallback: string; className?: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) return <Fallback text={fallback} className={className} />
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setFailed(true)}
      className={cn("shrink-0 rounded-full object-cover", className)}
    />
  )
}

function quoteOf(market: FuturesMarket) {
  return market.symbol.slice(market.base.length).replace("USDT", "USD")
}

function AssetIconBase({ market, size = 28 }: { market: FuturesMarket; size?: number }) {
  const box = { width: size, height: size }
  const textSize = size >= 28 ? "text-[10px]" : "text-[8px]"

  if (market.category === "crypto") {
    return (
      <span className="inline-flex shrink-0" style={box}>
        <RoundImage
          src={`${CRYPTO_CDN}/${market.base.toLowerCase()}.svg`}
          alt=""
          size={size}
          fallback={market.base.slice(0, 3)}
          className={cn("size-full", textSize)}
        />
      </span>
    )
  }

  if (market.category === "metals") {
    const metal = METAL_STYLE[market.base]
    return (
      <span
        aria-hidden="true"
        style={box}
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full font-bold ring-1 ring-inset",
          textSize,
          metal?.className ?? "bg-primary/15 text-primary ring-transparent",
        )}
      >
        {metal?.label ?? market.base.slice(0, 2)}
      </span>
    )
  }

  const base = CURRENCY_FLAG[market.base]
  const quote = CURRENCY_FLAG[quoteOf(market)]
  const flag = Math.round(size * 0.72)
  if (!base || !quote) return <Fallback text={market.base.slice(0, 3)} className={textSize} />
  return (
    <span aria-hidden="true" className="relative inline-flex shrink-0" style={box}>
      <RoundImage
        src={`${FLAG_CDN}/w80/${base}.png`}
        alt=""
        size={flag}
        fallback={market.base.slice(0, 1)}
        className="absolute left-0 top-0 ring-1 ring-term-line"
      />
      <RoundImage
        src={`${FLAG_CDN}/w80/${quote}.png`}
        alt=""
        size={flag}
        fallback={quoteOf(market).slice(0, 1)}
        className="absolute bottom-0 right-0 ring-2 ring-term-bg"
      />
    </span>
  )
}

export const AssetIcon = memo(AssetIconBase)
