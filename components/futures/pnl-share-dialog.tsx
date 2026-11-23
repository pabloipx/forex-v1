"use client"

import { useEffect, useRef, useState } from "react"
import QRCode from "qrcode"
import { toast } from "sonner"
import { Check, Download, Link2 } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { formatPrice } from "@/lib/futures/markets"

export interface PnlShareData {
  symbol: string
  side: "long" | "short"
  leverage: number
  roi: number
  entry: number
  current: number
  decimals: number
  demo: boolean
}

interface CardTheme {
  id: "light" | "dark"
  bg: [string, string]
  text: string
  muted: string
  strip: string
  logo: string
  rocket: string
  blend: "multiply" | "lighten"
}

const THEMES: CardTheme[] = [
  {
    id: "light",
    bg: ["#f3f6fb", "#e2e8f2"],
    text: "#0b1424",
    muted: "#5b6477",
    strip: "#ffffff",
    logo: "/images/kryptobit-logo-dark.png",
    rocket: "/images/pnl-rocket-light.png",
    blend: "multiply",
  },
  {
    id: "dark",
    bg: ["#0f1a30", "#070b14"],
    text: "#ffffff",
    muted: "#8b93a7",
    strip: "#121c30",
    logo: "/images/kryptobit-logo.png",
    rocket: "/images/pnl-rocket.png",
    blend: "lighten",
  },
]

const UP = "#20b26c"
const DOWN = "#f23645"
const ACCENT = "#f7a600"
const W = 720
const H = 940
const STRIP = 170

// Fades the rocket photo's edges so its backdrop melts into the card.
const ROCKET_MASK = "radial-gradient(58% 58% at 60% 56%, #000 45%, transparent 100%)"

function maskedRocket(img: HTMLImageElement, size: number) {
  const c = document.createElement("canvas")
  c.width = c.height = size
  const g = c.getContext("2d")!
  g.drawImage(img, 0, 0, size, size)
  g.globalCompositeOperation = "destination-in"
  const r = g.createRadialGradient(size * 0.6, size * 0.56, 0, size * 0.6, size * 0.56, size * 0.58)
  r.addColorStop(0.45, "rgba(0,0,0,1)")
  r.addColorStop(1, "rgba(0,0,0,0)")
  g.fillStyle = r
  g.fillRect(0, 0, size, size)
  return c
}

const fmtRoi = (roi: number) => `${roi >= 0 ? "+" : ""}${roi.toFixed(2)}%`
const sideLabel = (d: PnlShareData) => `${d.side === "long" ? "Long" : "Short"} ${d.leverage}x`

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

async function renderCard(d: PnlShareData, t: CardTheme, qr: string, host: string): Promise<Blob> {
  const canvas = document.createElement("canvas")
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext("2d")!
  const font = getComputedStyle(document.body).fontFamily
  const [logo, rocket, qrImg] = await Promise.all([loadImage(t.logo), loadImage(t.rocket), loadImage(qr)].map((p) => p.catch(() => null)))

  const grad = ctx.createLinearGradient(0, 0, W, H)
  grad.addColorStop(0, t.bg[0])
  grad.addColorStop(1, t.bg[1])
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, W, H)

  if (rocket) {
    ctx.globalCompositeOperation = t.blend
    ctx.drawImage(maskedRocket(rocket, 432), W - 432, H - STRIP - 432, 432, 432)
    ctx.globalCompositeOperation = "source-over"
  }

  let x = 48
  if (logo) {
    const lh = 52
    const lw = (logo.width / logo.height) * lh
    ctx.drawImage(logo, x, 44, lw, lh)
    x += lw + 14
  }
  if (d.demo) {
    ctx.font = `700 22px ${font}`
    const label = "Conta demo"
    const w = ctx.measureText(label).width + 28
    ctx.fillStyle = ACCENT
    ctx.beginPath()
    ctx.roundRect(x, 52, w, 38, 19)
    ctx.fill()
    ctx.fillStyle = "#0b1424"
    ctx.fillText(label, x + 14, 79)
  }

  ctx.fillStyle = t.text
  ctx.font = `800 50px ${font}`
  ctx.fillText(d.symbol, 48, 186)
  const tagX = 48 + ctx.measureText(d.symbol).width + 18
  ctx.font = `600 22px ${font}`
  const tag = sideLabel(d)
  const tagW = ctx.measureText(tag).width + 24
  ctx.fillStyle = d.side === "long" ? "rgba(32,178,108,0.16)" : "rgba(242,54,69,0.14)"
  ctx.beginPath()
  ctx.roundRect(tagX, 154, tagW, 38, 6)
  ctx.fill()
  ctx.fillStyle = d.side === "long" ? UP : DOWN
  ctx.fillText(tag, tagX + 12, 181)

  ctx.fillStyle = t.muted
  ctx.font = `500 24px ${font}`
  ctx.fillText("ROI", 48, 254)
  ctx.fillStyle = d.roi >= 0 ? UP : DOWN
  ctx.font = `800 96px ${font}`
  ctx.fillText(fmtRoi(d.roi), 42, 350)

  const row = (label: string, value: string, y: number) => {
    ctx.fillStyle = t.muted
    ctx.font = `500 24px ${font}`
    ctx.fillText(label, 48, y)
    ctx.fillStyle = t.text
    ctx.font = `700 36px ${font}`
    ctx.fillText(value, 48, y + 42)
  }
  row("Preço de entrada", formatPrice(d.entry, d.decimals), 430)
  row("Preço atual", formatPrice(d.current, d.decimals), 540)

  ctx.fillStyle = t.strip
  ctx.fillRect(0, H - STRIP, W, STRIP)
  ctx.fillStyle = t.muted
  ctx.font = `500 24px ${font}`
  ctx.fillText("Escaneie o QR code e cadastre-se!", 48, H - STRIP + 66)
  ctx.fillStyle = t.text
  ctx.font = `800 36px ${font}`
  ctx.fillText(host, 48, H - STRIP + 116)
  if (qrImg) {
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(W - 48 - 128, H - STRIP + 21, 128, 128)
    ctx.drawImage(qrImg, W - 48 - 122, H - STRIP + 27, 116, 116)
  }

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Falha ao gerar imagem"))), "image/png"),
  )
}

function ShareCard({ d, t, qr, host }: { d: PnlShareData; t: CardTheme; qr: string | null; host: string }) {
  const up = d.roi >= 0
  return (
    <div
      className="relative flex aspect-[720/940] w-full flex-col overflow-hidden rounded-2xl"
      style={{ background: `linear-gradient(135deg, ${t.bg[0]}, ${t.bg[1]})`, color: t.text }}
    >
      <img
        src={t.rocket}
        alt=""
        className="pointer-events-none absolute right-0 w-[60%]"
        style={{
          bottom: `${(STRIP / H) * 100}%`,
          mixBlendMode: t.blend,
          maskImage: ROCKET_MASK,
          WebkitMaskImage: ROCKET_MASK,
        }}
      />
      <div className="relative flex flex-1 flex-col gap-[3.5%] p-[6.5%]">
        <div className="flex items-center gap-2">
          <img src={t.logo} alt="Kryptobit" className="h-6 w-auto sm:h-7" />
          {d.demo && (
            <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: ACCENT, color: "#0b1424" }}>
              Conta demo
            </span>
          )}
        </div>
        <div className="mt-[3%] flex flex-wrap items-center gap-2">
          <span className="text-xl font-extrabold tracking-tight sm:text-2xl">{d.symbol}</span>
          <span
            className="rounded px-1.5 py-0.5 text-[11px] font-semibold"
            style={{
              background: d.side === "long" ? "rgba(32,178,108,0.16)" : "rgba(242,54,69,0.14)",
              color: d.side === "long" ? UP : DOWN,
            }}
          >
            {sideLabel(d)}
          </span>
        </div>
        <div className="flex flex-col">
          <span className="text-xs" style={{ color: t.muted }}>
            ROI
          </span>
          <span className="font-mono text-4xl font-extrabold leading-tight sm:text-[2.75rem]" style={{ color: up ? UP : DOWN }}>
            {fmtRoi(d.roi)}
          </span>
        </div>
        <dl className="flex flex-col gap-2">
          <div className="flex flex-col">
            <dt className="text-xs" style={{ color: t.muted }}>
              Preço de entrada
            </dt>
            <dd className="font-mono text-base font-bold sm:text-lg">{formatPrice(d.entry, d.decimals)}</dd>
          </div>
          <div className="flex flex-col">
            <dt className="text-xs" style={{ color: t.muted }}>
              Preço atual
            </dt>
            <dd className="font-mono text-base font-bold sm:text-lg">{formatPrice(d.current, d.decimals)}</dd>
          </div>
        </dl>
      </div>
      <div
        className="relative flex items-center justify-between gap-3 px-[6.5%]"
        style={{ background: t.strip, height: `${(STRIP / H) * 100}%` }}
      >
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[11px]" style={{ color: t.muted }}>
            Escaneie o QR code e cadastre-se!
          </span>
          <span className="truncate text-base font-extrabold sm:text-lg">{host}</span>
        </div>
        {qr && <img src={qr} alt="QR code para criar conta" className="aspect-square h-[72%] rounded-sm bg-white p-0.5" />}
      </div>
    </div>
  )
}

// "glyph": white mark on a brand-colored circle. "logo": the brand mark is already a filled circle.
const TARGETS = [
  { name: "whatsapp", label: "WhatsApp", color: "#25D366", mode: "glyph" },
  { name: "x", label: "X", color: "#000000", mode: "glyph" },
  { name: "telegram", label: "Telegram", color: "#ffffff", mode: "logo" },
  { name: "facebook", label: "Facebook", color: "#ffffff", mode: "logo" },
] as const

export function PnlShareDialog({ data, onClose }: { data: PnlShareData; onClose: () => void }) {
  const [active, setActive] = useState(0)
  const [qr, setQr] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  const origin = typeof window !== "undefined" ? window.location.origin : ""
  const host = origin.replace(/^https?:\/\//, "").replace(/^www\./, "")
  const signup = `${origin}/auth/sign-up`
  const text = `${data.symbol} ${sideLabel(data)} · ROI ${fmtRoi(data.roi)} na Kryptobit`

  useEffect(() => {
    let alive = true
    QRCode.toDataURL(signup, { margin: 1, width: 240, color: { dark: "#0b1424", light: "#ffffff" } })
      .then((url) => alive && setQr(url))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [signup])

  const onScroll = () => {
    const el = scroller.current
    if (!el) return
    const item = el.firstElementChild as HTMLElement | null
    if (!item) return
    setActive(Math.round(el.scrollLeft / (item.offsetWidth + 12)))
  }

  const goTo = (i: number) => {
    const el = scroller.current
    const item = el?.children[i] as HTMLElement | undefined
    if (el && item) el.scrollTo({ left: item.offsetLeft - el.offsetLeft - 16, behavior: "smooth" })
  }

  const save = async () => {
    setSaving(true)
    try {
      const blob = await renderCard(data, THEMES[active] ?? THEMES[0], qr ?? "", host)
      const file = new File([blob], `kryptobit-${data.symbol}-pnl.png`, { type: "image/png" })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text }).catch(() => {})
      } else {
        const href = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = href
        a.download = file.name
        a.click()
        URL.revokeObjectURL(href)
        toast.success("Imagem salva")
      }
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const copy = async () => {
    await navigator.clipboard.writeText(`${text} ${signup}`).catch(() => {})
    setCopied(true)
    toast.success("Link copiado")
    setTimeout(() => setCopied(false), 2000)
  }

  const enc = encodeURIComponent
  const hrefs: Record<(typeof TARGETS)[number]["name"], string> = {
    whatsapp: `https://wa.me/?text=${enc(`${text} ${signup}`)}`,
    x: `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(signup)}`,
    telegram: `https://t.me/share/url?url=${enc(signup)}&text=${enc(text)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${enc(signup)}`,
  }

  const action = "flex min-w-0 flex-col items-center gap-1.5 text-[11px] text-term-muted transition-colors hover:text-term-text"
  const bubble = "flex size-11 items-center justify-center rounded-full"

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className={cn(
          "block max-h-[94dvh] overflow-y-auto overflow-x-hidden border-term-line bg-term-panel p-0 text-term-text sm:max-w-md",
          "max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-auto max-sm:max-w-none max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-2xl",
        )}
      >
        <div className="flex min-w-0 flex-col gap-4 pb-5 pt-2 sm:pt-5">
          <span className="mx-auto h-1 w-10 rounded-full bg-term-line sm:hidden" aria-hidden />
          <DialogHeader className="px-4 text-left">
            <DialogTitle className="text-base font-bold">Compartilhar P&L</DialogTitle>
            <DialogDescription className="sr-only">Escolha um cartão e compartilhe o resultado da posição</DialogDescription>
          </DialogHeader>

          <div
            ref={scroller}
            onScroll={onScroll}
            className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {THEMES.map((t) => (
              <div key={t.id} className="w-[82%] shrink-0 snap-start">
                <ShareCard d={data} t={t} qr={qr} host={host} />
              </div>
            ))}
            <span className="w-px shrink-0" aria-hidden />
          </div>

          <div className="flex justify-center gap-1.5" role="tablist" aria-label="Modelo do cartão">
            {THEMES.map((t, i) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={active === i}
                aria-label={t.id === "light" ? "Cartão claro" : "Cartão escuro"}
                onClick={() => goTo(i)}
                className={cn("h-1 rounded-full transition-all", active === i ? "w-5 bg-term-text" : "w-2.5 bg-term-line")}
              />
            ))}
          </div>

          <div className="grid grid-cols-6 gap-1 px-3">
            <button type="button" onClick={save} disabled={saving} className={action}>
              <span className={cn(bubble, "bg-term-line text-term-text")}>
                <Download className="size-5" aria-hidden />
              </span>
              {saving ? "Gerando..." : "Salvar"}
            </button>
            <button type="button" onClick={copy} className={action}>
              <span className={cn(bubble, "bg-term-line text-term-text")}>
                {copied ? <Check className="size-5 text-long" aria-hidden /> : <Link2 className="size-5" aria-hidden />}
              </span>
              <span className="truncate">Copiar link</span>
            </button>
            {TARGETS.map((t) => (
              <a key={t.name} href={hrefs[t.name]} target="_blank" rel="noopener noreferrer" className={action}>
                <span
                  className={cn(bubble, "overflow-hidden", t.name === "x" && "ring-1 ring-term-line")}
                  style={{ background: t.color }}
                >
                  <img
                    src={`https://cdn.jsdelivr.net/gh/glincker/thesvg@main/public/icons/${t.name}/default.svg`}
                    alt=""
                    width={44}
                    height={44}
                    className={t.mode === "glyph" ? "size-5 brightness-0 invert" : "size-11"}
                  />
                </span>
                {t.label}
              </a>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
