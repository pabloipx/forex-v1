import Link from "next/link"

const NAV = [
  { href: "#mercados", label: "Mercados" },
  { href: "#plataforma", label: "Plataforma" },
  { href: "#condicoes", label: "Condições" },
  { href: "/futures", label: "Negociar" },
]

export function SiteHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 px-4 py-4">
      <div className="mx-auto flex max-w-7xl items-center justify-between rounded-full border border-white/10 bg-[#06100c]/75 px-4 py-2.5 backdrop-blur-xl">
        <Link href="/" className="flex items-center" aria-label="Kryptobit — início">
          <img src="/images/kryptobit-logo.png" alt="Kryptobit" className="h-8 w-auto sm:h-9" />
        </Link>

        <nav aria-label="Principal" className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 lg:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-4 py-2 text-sm font-medium text-white/75 transition-colors hover:bg-white/10 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/auth/login"
            className="whitespace-nowrap rounded-full border border-white/15 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10 sm:px-4"
          >
            Entrar
          </Link>
          <Link
            href="/auth/sign-up"
            className="whitespace-nowrap rounded-full bg-[#2190ff] px-3 py-2 text-sm font-semibold text-[#03140d] transition-colors hover:bg-[#4da6ff] sm:px-4"
          >
            Abrir conta
          </Link>
        </div>
      </div>
    </header>
  )
}
