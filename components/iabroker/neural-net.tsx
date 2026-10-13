"use client"

import { useEffect, useRef, useState } from "react"

type Node = {
  id: number
  x: number
  y: number
  r: number
  layer: number
  label?: string
}

type Edge = {
  from: number
  to: number
}

/**
 * Rede neural animada: nós de IA distribuídos em camadas que trocam
 * "pacotes" de informação pelas conexões. Puramente decorativo — roda
 * um único requestAnimationFrame e para quando a aba fica oculta.
 */
export function NeuralNet({ active = true }: { active?: boolean }) {
  const W = 340
  const H = 200

  // Camadas: 1 entrada (mercado) → 2 ocultas → 1 saída (decisão)
  const layout: { count: number; label?: string[] }[] = [
    { count: 3, label: ["EUR/USD", "BTC/USD", "XAU"] },
    { count: 4 },
    { count: 4 },
    { count: 2, label: ["COMPRA", "VENDA"] },
  ]

  const nodesRef = useRef<Node[]>([])
  const edgesRef = useRef<Edge[]>([])

  if (nodesRef.current.length === 0) {
    const nodes: Node[] = []
    const edges: Edge[] = []
    const padX = 30
    const usableW = W - padX * 2
    let id = 0
    const layerNodeIds: number[][] = []

    layout.forEach((layer, li) => {
      const ids: number[] = []
      const x = padX + (usableW * li) / (layout.length - 1)
      const gap = H / (layer.count + 1)
      for (let n = 0; n < layer.count; n++) {
        const y = gap * (n + 1)
        nodes.push({
          id,
          x,
          y,
          r: li === 0 || li === layout.length - 1 ? 6 : 4.5,
          layer: li,
          label: layer.label?.[n],
        })
        ids.push(id)
        id++
      }
      layerNodeIds.push(ids)
    })

    for (let li = 0; li < layerNodeIds.length - 1; li++) {
      for (const a of layerNodeIds[li]) {
        for (const b of layerNodeIds[li + 1]) {
          edges.push({ from: a, to: b })
        }
      }
    }

    nodesRef.current = nodes
    edgesRef.current = edges
  }

  const nodes = nodesRef.current
  const edges = edgesRef.current

  // Pacotes que viajam pelas arestas
  const [, setTick] = useState(0)
  const packetsRef = useRef<{ edge: number; t: number; speed: number }[]>([])
  const pulseRef = useRef<Record<number, number>>({})
  const rafRef = useRef<number | null>(null)
  const lastSpawn = useRef(0)

  useEffect(() => {
    if (!active) return
    let last = performance.now()

    const loop = (now: number) => {
      const dt = Math.min(50, now - last) / 1000
      last = now

      // Spawn de novos pacotes a partir da camada de entrada
      if (now - lastSpawn.current > 220) {
        lastSpawn.current = now
        const entryEdges = edges
          .map((e, i) => ({ e, i }))
          .filter(({ e }) => nodes[e.from].layer === 0)
        for (let k = 0; k < 2; k++) {
          const pick = entryEdges[Math.floor(Math.random() * entryEdges.length)]
          if (pick) packetsRef.current.push({ edge: pick.i, t: 0, speed: 0.9 + Math.random() * 0.8 })
        }
      }

      // Avança pacotes; ao chegar ao fim, acende o nó destino e propaga
      const survivors: typeof packetsRef.current = []
      for (const p of packetsRef.current) {
        p.t += p.speed * dt
        if (p.t >= 1) {
          const edge = edges[p.edge]
          const toNode = edge.to
          pulseRef.current[toNode] = 1
          const nextEdges = edges
            .map((e, i) => ({ e, i }))
            .filter(({ e }) => e.from === toNode)
          if (nextEdges.length) {
            const pick = nextEdges[Math.floor(Math.random() * nextEdges.length)]
            packetsRef.current.push({ edge: pick.i, t: 0, speed: 0.9 + Math.random() * 0.8 })
          }
        } else {
          survivors.push(p)
        }
      }
      packetsRef.current = survivors.slice(-60)

      // Decai o brilho dos nós
      for (const k of Object.keys(pulseRef.current)) {
        const key = Number(k)
        pulseRef.current[key] = Math.max(0, pulseRef.current[key] - dt * 1.5)
      }

      setTick((t) => (t + 1) % 1000000)
      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)

    const onVis = () => {
      if (document.hidden && rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      } else if (!document.hidden && !rafRef.current) {
        last = performance.now()
        rafRef.current = requestAnimationFrame(loop)
      }
    }
    document.addEventListener("visibilitychange", onVis)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      document.removeEventListener("visibilitychange", onVis)
    }
  }, [active, edges, nodes])

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-full"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="nn-node" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffb27a" />
          <stop offset="100%" stopColor="#f97316" />
        </radialGradient>
        <linearGradient id="nn-packet" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#fdba74" stopOpacity="0" />
          <stop offset="100%" stopColor="#fdba74" stopOpacity="1" />
        </linearGradient>
      </defs>

      {/* arestas */}
      {edges.map((e, i) => {
        const a = nodes[e.from]
        const b = nodes[e.to]
        return (
          <line
            key={i}
            x1={a.x}
            y1={a.y}
            x2={b.x}
            y2={b.y}
            stroke="#f97316"
            strokeOpacity={0.1}
            strokeWidth={0.6}
          />
        )
      })}

      {/* pacotes viajando */}
      {packetsRef.current.map((p, i) => {
        const e = edges[p.edge]
        if (!e) return null
        const a = nodes[e.from]
        const b = nodes[e.to]
        const x = a.x + (b.x - a.x) * p.t
        const y = a.y + (b.y - a.y) * p.t
        return <circle key={i} cx={x} cy={y} r={1.7} fill="#fed7aa" opacity={0.9} />
      })}

      {/* nós */}
      {nodes.map((n) => {
        const pulse = pulseRef.current[n.id] || 0
        return (
          <g key={n.id}>
            {pulse > 0 && (
              <circle cx={n.x} cy={n.y} r={n.r + 4 + pulse * 5} fill="#f97316" opacity={pulse * 0.25} />
            )}
            <circle
              cx={n.x}
              cy={n.y}
              r={n.r}
              fill="url(#nn-node)"
              opacity={0.55 + pulse * 0.45}
            />
            {n.label && (
              <text
                x={n.x}
                y={n.layer === 0 ? n.y - 9 : n.y + 14}
                textAnchor="middle"
                className="fill-muted-foreground"
                style={{ fontSize: 7, fontFamily: "var(--font-mono, monospace)" }}
              >
                {n.label}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
