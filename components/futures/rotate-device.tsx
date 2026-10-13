import { Smartphone } from "lucide-react"

export function RotateDevice() {
  return (
    <div
      role="alert"
      className="fixed inset-0 z-50 hidden flex-col items-center justify-center gap-5 bg-term-bg px-8 text-center phone-portrait:flex"
    >
      <Smartphone className="size-12 rotate-90 text-primary motion-safe:animate-pulse" aria-hidden="true" />
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-bold text-term-text text-balance">Gire o celular</h2>
        <p className="text-sm leading-relaxed text-term-muted text-pretty">
          O terminal de negociação funciona no modo paisagem. Vire o aparelho de lado para ver gráfico, livro de ofertas e
          painel de ordens.
        </p>
      </div>
    </div>
  )
}
