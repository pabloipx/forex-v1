"use client"

import { useEffect, useMemo, useRef } from "react"

// Fundo animado do hero: orbes de brilho flutuantes, grade em perspectiva e
// particulas subindo. Tudo reage a rolagem (parallax + fade) via requestAnimationFrame.
export function HeroBackground() {
  const rootRef = useRef<HTMLDivElement>(null)
  const slowRef = useRef<HTMLDivElement>(null)
  const midRef = useRef<HTMLDivElement>(null)
  const fastRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)

  // Particulas geradas uma unica vez (posicao/tamanho/tempo aleatorios estaveis).
  const particles = useMemo(
    () =>
      Array.from({ length: 26 }).map((_, i) => ({
        id: i,
        left: Math.random() * 100,
        top: 40 + Math.random() * 55,
        size: 2 + Math.random() * 4,
        duration: 7 + Math.random() * 8,
        delay: -Math.random() * 10,
        opacity: 0.35 + Math.random() * 0.5,
      })),
    [],
  )

  useEffect(() => {
    let raf = 0
    const onScroll = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        const y = window.scrollY
        // Parallax em camadas: cada uma se move em velocidade diferente.
        if (slowRef.current) slowRef.current.style.transform = `translate3d(0, ${y * 0.15}px, 0)`
        if (midRef.current) midRef.current.style.transform = `translate3d(0, ${y * 0.3}px, 0)`
        if (fastRef.current) fastRef.current.style.transform = `translate3d(0, ${y * 0.5}px, 0)`
        if (gridRef.current) {
          gridRef.current.style.transform = `translate3d(0, ${y * 0.25}px, 0)`
          gridRef.current.style.opacity = String(Math.max(0, 0.6 - y / 800))
        }
        // O bloco inteiro some suavemente conforme rola para longe do hero.
        if (rootRef.current) {
          rootRef.current.style.opacity = String(Math.max(0, 1 - y / 900))
        }
      })
    }
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", onScroll)
      cancelAnimationFrame(raf)
    }
  }, [])

  return (
    <div ref={rootRef} aria-hidden="true" className="absolute inset-0 overflow-hidden">
      {/* Base escura */}
      <div className="absolute inset-0 bg-[#07090d]" />

      {/* Grade em perspectiva */}
      <div ref={gridRef} className="absolute inset-0">
        <div
          className="hero-grid absolute inset-x-0 bottom-0 top-1/3 [mask-image:linear-gradient(to_top,black,transparent)]"
          style={{ transform: "perspective(500px) rotateX(60deg)", transformOrigin: "bottom" }}
        />
      </div>

      {/* Camada lenta — orbe grande central */}
      <div ref={slowRef} className="absolute inset-0">
        <div className="animate-hero-float-a absolute left-1/2 top-1/4 h-[34rem] w-[34rem] -translate-x-1/2 rounded-full bg-[#f97316]/25 blur-[140px]" />
      </div>

      {/* Camada média — dois orbes laterais */}
      <div ref={midRef} className="absolute inset-0">
        <div className="animate-hero-float-b absolute left-[8%] top-[30%] h-72 w-72 rounded-full bg-[#fb923c]/20 blur-[110px]" />
        <div className="animate-hero-float-c absolute right-[6%] top-[45%] h-80 w-80 rounded-full bg-[#f97316]/18 blur-[120px]" />
      </div>

      {/* Camada rápida — brilho quente inferior + partículas */}
      <div ref={fastRef} className="absolute inset-0">
        <div className="animate-hero-pulse absolute bottom-[12%] left-1/2 h-56 w-[38rem] max-w-[92%] -translate-x-1/2 rounded-full bg-[#fdba74]/15 blur-[100px]" />

        {particles.map((p) => (
          <span
            key={p.id}
            className="animate-hero-particle absolute rounded-full bg-[#fdba74] shadow-[0_0_8px_2px_rgba(251,146,60,0.6)]"
            style={
              {
                left: `${p.left}%`,
                top: `${p.top}%`,
                width: `${p.size}px`,
                height: `${p.size}px`,
                "--p-duration": `${p.duration}s`,
                "--p-delay": `${p.delay}s`,
                "--p-opacity": p.opacity,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      {/* Vinheta para dar profundidade e leitura do texto */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#07090d]/40 via-transparent to-[#07090d]" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#07090d] via-transparent to-[#07090d]" />
    </div>
  )
}
