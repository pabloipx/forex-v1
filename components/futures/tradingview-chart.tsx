"use client"

import { memo, useEffect, useId, useRef } from "react"

declare global {
  interface Window {
    TradingView?: { widget: new (config: Record<string, unknown>) => { remove?: () => void } }
  }
}

let scriptPromise: Promise<void> | null = null
function loadTradingView() {
  if (typeof window !== "undefined" && window.TradingView) return Promise.resolve()
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script")
      s.src = "https://s3.tradingview.com/tv.js"
      s.async = true
      s.onload = () => resolve()
      s.onerror = () => {
        scriptPromise = null
        reject(new Error("Falha ao carregar o TradingView"))
      }
      document.head.appendChild(s)
    })
  }
  return scriptPromise
}

function TradingViewChartImpl({ symbol }: { symbol: string }) {
  const containerId = `tv_${useId().replace(/:/g, "")}`
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    let widget: { remove?: () => void } | null = null
    loadTradingView()
      .then(() => {
        if (cancelled || !window.TradingView || !containerRef.current) return
        containerRef.current.innerHTML = ""
        widget = new window.TradingView.widget({
          container_id: containerId,
          symbol,
          interval: "15",
          timezone: "America/Sao_Paulo",
          theme: "dark",
          style: "1",
          locale: "br",
          autosize: true,
          toolbar_bg: "#15181d",
          backgroundColor: "#15181d",
          gridColor: "rgba(35, 39, 46, 0.6)",
          enable_publishing: false,
          allow_symbol_change: false,
          hide_side_toolbar: false,
          withdateranges: true,
          save_image: true,
          studies: ["Volume@tv-basicstudies"],
          overrides: {
            "paneProperties.background": "#15181d",
            "paneProperties.backgroundType": "solid",
            "mainSeriesProperties.candleStyle.upColor": "#20b26c",
            "mainSeriesProperties.candleStyle.downColor": "#ef454a",
            "mainSeriesProperties.candleStyle.borderUpColor": "#20b26c",
            "mainSeriesProperties.candleStyle.borderDownColor": "#ef454a",
            "mainSeriesProperties.candleStyle.wickUpColor": "#20b26c",
            "mainSeriesProperties.candleStyle.wickDownColor": "#ef454a",
          },
        })
      })
      .catch(() => {
        if (containerRef.current) {
          containerRef.current.innerHTML =
            '<p style="color:#848e9c;padding:16px;font-size:13px">Não foi possível carregar o gráfico.</p>'
        }
      })
    return () => {
      cancelled = true
      try {
        widget?.remove?.()
      } catch {
        // o widget pode ja ter sido desmontado pelo proprio TradingView
      }
    }
  }, [symbol, containerId])

  return <div id={containerId} ref={containerRef} className="h-full w-full" />
}

export const TradingViewChart = memo(TradingViewChartImpl)
