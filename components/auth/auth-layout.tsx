import type React from "react"
import Image from "next/image"
import Link from "next/link"
import { ArrowRightLeft, Globe } from "lucide-react"

export const AUTH_ACCENT = "bg-blue-600 hover:bg-blue-700 text-white"
export const AUTH_ACCENT_TEXT = "text-blue-600"
export const AUTH_INPUT =
  "w-full h-12 px-4 rounded-lg bg-gray-100 text-gray-900 text-[15px] border border-transparent outline-none transition-colors placeholder:text-gray-400 focus:border-blue-600 focus:bg-white disabled:opacity-50"
export const AUTH_LABEL = "text-sm font-medium text-gray-800"

const STATS = [
  { value: "24/7", label: "Mercado aberto" },
  { value: "0", label: "Taxa de cadastro" },
  { value: "PIX", label: "Depósito instantâneo" },
]

function HeroPanel() {
  return (
    <aside className="relative hidden lg:flex lg:w-1/2 flex-col justify-between overflow-hidden bg-gray-900">
      <Image src="/images/signup-hero.png" alt="" fill priority sizes="50vw" className="object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/20" aria-hidden />

      <h2 className="relative z-10 ml-auto max-w-md px-12 pt-16 text-right text-4xl font-normal leading-tight text-white text-balance">
        Opere futuros de cripto diretamente com a Kryptobit
      </h2>

      <div className="relative z-10 grid grid-cols-3 bg-black/45 backdrop-blur-md px-12 py-6">
        {STATS.map((s, i) => (
          <div key={s.label} className={`flex flex-col gap-1 ${i > 0 ? "border-l border-white/20 pl-10" : ""}`}>
            <span className="text-4xl font-light text-white">{s.value}</span>
            <span className="text-lg text-white/80">{s.label}</span>
          </div>
        ))}
      </div>
    </aside>
  )
}

type AuthLayoutProps = {
  title: React.ReactNode
  switchHref: string
  switchLabel: string
  overlay?: React.ReactNode
  children: React.ReactNode
}

export function AuthLayout({ title, switchHref, switchLabel, overlay, children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen w-full flex bg-[#f5f6fa]">
      {overlay}
      <HeroPanel />

      <main className="flex-1 flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-[440px] flex flex-col gap-5">
          <div className="relative flex items-center justify-center">
            <Link href="/" aria-label="Kryptobit - página inicial">
              <Image
                src="/images/kryptobit-logo-dark.png"
                alt="Kryptobit"
                width={150}
                height={38}
                className="h-9 w-auto"
                unoptimized
              />
            </Link>
            <span className="absolute right-0 flex items-center text-gray-700" aria-label="Idioma: Português">
              <Globe className="w-5 h-5" />
            </span>
          </div>

          <section className="rounded-2xl bg-white shadow-sm">
            <header className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div className="flex items-center gap-2">{title}</div>
              <Link
                href={switchHref}
                className={`flex items-center gap-1.5 text-sm font-medium ${AUTH_ACCENT_TEXT} hover:underline`}
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                {switchLabel}
              </Link>
            </header>
            {children}
          </section>
        </div>
      </main>
    </div>
  )
}
