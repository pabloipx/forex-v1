import type { Candle } from "./candles"

export type PlotPane = "price" | "separate"

export interface ScriptPlot {
  title: string
  color: string
  width: number
  pane: PlotPane
  type: "line" | "histogram"
  data: (number | null)[]
}

export interface ScriptHLine {
  price: number
  title: string
  color: string
  pane: PlotPane
}

export interface ScriptMarker {
  index: number
  position: "above" | "below"
  color: string
  shape: "arrowUp" | "arrowDown" | "circle"
  text: string
}

export interface ScriptOutput {
  plots: ScriptPlot[]
  hlines: ScriptHLine[]
  markers: ScriptMarker[]
}

export type ScriptResult = { ok: true; output: ScriptOutput } | { ok: false; error: string }

const TIMEOUT_MS = 1500

// Roda dentro de um Web Worker isolado: sem DOM, sem rede, sem acesso a cookies/sessao.
const WORKER_SOURCE = `
"use strict";
const MAX_PLOTS = 20, MAX_MARKERS = 2000;
const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const ta = {
  sma(src, n) { const o = new Array(src.length).fill(null); let s = 0, c = 0;
    for (let i = 0; i < src.length; i++) { const v = num(src[i]); if (v == null) { s = 0; c = 0; continue; }
      s += v; c++; if (c > n) { s -= src[i - n]; c = n; } if (c === n) o[i] = s / n; } return o; },
  ema(src, n) { const o = new Array(src.length).fill(null); const k = 2 / (n + 1); let prev = null, s = 0, c = 0;
    for (let i = 0; i < src.length; i++) { const v = num(src[i]); if (v == null) continue;
      if (prev == null) { s += v; c++; if (c === n) { prev = s / n; o[i] = prev; } }
      else { prev = v * k + prev * (1 - k); o[i] = prev; } } return o; },
  rma(src, n) { const o = new Array(src.length).fill(null); let prev = null, s = 0, c = 0;
    for (let i = 0; i < src.length; i++) { const v = num(src[i]); if (v == null) continue;
      if (prev == null) { s += v; c++; if (c === n) { prev = s / n; o[i] = prev; } }
      else { prev = (prev * (n - 1) + v) / n; o[i] = prev; } } return o; },
  stdev(src, n) { const m = ta.sma(src, n); return src.map((_, i) => { if (m[i] == null) return null; let s = 0;
    for (let j = i - n + 1; j <= i; j++) s += (src[j] - m[i]) ** 2; return Math.sqrt(s / n); }); },
  highest(src, n) { return src.map((_, i) => i < n - 1 ? null : Math.max(...src.slice(i - n + 1, i + 1))); },
  lowest(src, n) { return src.map((_, i) => i < n - 1 ? null : Math.min(...src.slice(i - n + 1, i + 1))); },
  change(src, n = 1) { return src.map((v, i) => i < n || src[i - n] == null || v == null ? null : v - src[i - n]); },
  rsi(src, n = 14) { const up = [], dn = []; for (let i = 0; i < src.length; i++) { const d = i ? src[i] - src[i - 1] : 0;
      up.push(Math.max(d, 0)); dn.push(Math.max(-d, 0)); }
    const ru = ta.rma(up, n), rd = ta.rma(dn, n);
    return src.map((_, i) => i < n || ru[i] == null ? null : rd[i] === 0 ? 100 : 100 - 100 / (1 + ru[i] / rd[i])); },
  tr() { return close.map((c, i) => i === 0 ? high[i] - low[i] : Math.max(high[i] - low[i], Math.abs(high[i] - close[i - 1]), Math.abs(low[i] - close[i - 1]))); },
  atr(n = 14) { return ta.rma(ta.tr(), n); },
  bb(src, n = 20, mult = 2) { const m = ta.sma(src, n), sd = ta.stdev(src, n);
    return { middle: m, upper: m.map((v, i) => v == null ? null : v + mult * sd[i]), lower: m.map((v, i) => v == null ? null : v - mult * sd[i]) }; },
  macd(src, fast = 12, slow = 26, sig = 9) { const f = ta.ema(src, fast), s = ta.ema(src, slow);
    const macd = f.map((v, i) => v == null || s[i] == null ? null : v - s[i]); const signal = ta.ema(macd, sig);
    return { macd, signal, hist: macd.map((v, i) => v == null || signal[i] == null ? null : v - signal[i]) }; },
  vwap() { let pv = 0, vv = 0, day = -1; return close.map((c, i) => { const d = Math.floor(time[i] / 86400);
    if (d !== day) { day = d; pv = 0; vv = 0; } const tp = (high[i] + low[i] + c) / 3; pv += tp * (volume[i] || 0); vv += volume[i] || 0;
    return vv ? pv / vv : tp; }); },
  crossover(a, b) { const bv = (x, i) => Array.isArray(x) ? x[i] : x;
    return a.map((v, i) => i > 0 && v != null && bv(b, i) != null && a[i - 1] != null && bv(b, i - 1) != null && v > bv(b, i) && a[i - 1] <= bv(b, i - 1)); },
  crossunder(a, b) { const bv = (x, i) => Array.isArray(x) ? x[i] : x;
    return a.map((v, i) => i > 0 && v != null && bv(b, i) != null && a[i - 1] != null && bv(b, i - 1) != null && v < bv(b, i) && a[i - 1] >= bv(b, i - 1)); },
};
let open, high, low, close, volume, time, hl2, hlc3;
self.onmessage = (e) => {
  const { code, bars } = e.data;
  open = bars.map((b) => b.open); high = bars.map((b) => b.high); low = bars.map((b) => b.low);
  close = bars.map((b) => b.close); volume = bars.map((b) => b.volume); time = bars.map((b) => b.time);
  hl2 = bars.map((b) => (b.high + b.low) / 2); hlc3 = bars.map((b) => (b.high + b.low + b.close) / 3);
  const out = { plots: [], hlines: [], markers: [] };
  const toSeries = (v) => Array.isArray(v) ? v.map(num) : new Array(bars.length).fill(num(v));
  const plot = (series, o = {}) => { if (out.plots.length >= MAX_PLOTS) throw new Error("Limite de " + MAX_PLOTS + " plots por script");
    out.plots.push({ title: String(o.title ?? "Plot " + (out.plots.length + 1)).slice(0, 40), color: String(o.color ?? "#2962ff"),
      width: Math.min(4, Math.max(1, Number(o.width) || 2)), pane: o.pane === "separate" ? "separate" : "price",
      type: o.type === "histogram" ? "histogram" : "line", data: toSeries(series).slice(0, bars.length) }); };
  const hline = (price, o = {}) => { const p = num(price); if (p == null) return;
    out.hlines.push({ price: p, title: String(o.title ?? "").slice(0, 40), color: String(o.color ?? "#848e9c"), pane: o.pane === "separate" ? "separate" : "price" }); };
  const signal = (cond, o = {}) => { const arr = Array.isArray(cond) ? cond : [];
    const buy = (o.side ?? "buy") === "buy";
    arr.forEach((c, i) => { if (c && out.markers.length < MAX_MARKERS) out.markers.push({ index: i, position: buy ? "below" : "above",
      color: String(o.color ?? (buy ? "#20b26c" : "#ef454a")), shape: buy ? "arrowUp" : "arrowDown", text: String(o.text ?? "").slice(0, 12) }); }); };
  try {
    const fn = new Function("open", "high", "low", "close", "volume", "time", "hl2", "hlc3", "bars", "ta", "plot", "hline", "signal", "Math", code);
    fn(open, high, low, close, volume, time, hl2, hlc3, bars, ta, plot, hline, signal, Math);
    self.postMessage({ ok: true, output: out });
  } catch (err) {
    self.postMessage({ ok: false, error: err && err.message ? String(err.message) : String(err) });
  }
};
for (const k of ["fetch", "XMLHttpRequest", "WebSocket", "EventSource", "importScripts", "indexedDB", "caches", "BroadcastChannel"]) {
  try { Object.defineProperty(self, k, { value: undefined, configurable: false, writable: false }); } catch {}
}
`

let workerUrl: string | null = null
function getWorkerUrl() {
  if (!workerUrl) workerUrl = URL.createObjectURL(new Blob([WORKER_SOURCE], { type: "text/javascript" }))
  return workerUrl
}

export function runScript(code: string, bars: Candle[]): Promise<ScriptResult> {
  return new Promise((resolve) => {
    const worker = new Worker(getWorkerUrl())
    const timer = setTimeout(() => {
      worker.terminate()
      resolve({ ok: false, error: `Tempo limite de ${TIMEOUT_MS}ms excedido (loop infinito?)` })
    }, TIMEOUT_MS)
    worker.onmessage = (e: MessageEvent<ScriptResult>) => {
      clearTimeout(timer)
      worker.terminate()
      resolve(e.data)
    }
    worker.onerror = (e) => {
      e.preventDefault()
      clearTimeout(timer)
      worker.terminate()
      resolve({ ok: false, error: e.message || "Erro de sintaxe no script" })
    }
    worker.postMessage({ code, bars })
  })
}

export const SCRIPT_TEMPLATES: { name: string; code: string }[] = [
  {
    name: "Cruzamento de médias",
    code: `// Médias móveis exponenciais com sinais de cruzamento
const rapida = ta.ema(close, 9)
const lenta = ta.ema(close, 21)

plot(rapida, { title: "EMA 9", color: "#f7a600" })
plot(lenta, { title: "EMA 21", color: "#2962ff" })

signal(ta.crossover(rapida, lenta), { side: "buy", text: "C" })
signal(ta.crossunder(rapida, lenta), { side: "sell", text: "V" })
`,
  },
  {
    name: "RSI",
    code: `// Índice de força relativa em painel separado
const rsi = ta.rsi(close, 14)

plot(rsi, { title: "RSI 14", color: "#b388ff", pane: "separate" })
hline(70, { title: "70", color: "#ef454a", pane: "separate" })
hline(30, { title: "30", color: "#20b26c", pane: "separate" })
`,
  },
  {
    name: "Bandas de Bollinger",
    code: `const { upper, middle, lower } = ta.bb(close, 20, 2)

plot(upper, { title: "BB sup", color: "#26a69a", width: 1 })
plot(middle, { title: "BB méd", color: "#848e9c", width: 1 })
plot(lower, { title: "BB inf", color: "#26a69a", width: 1 })
`,
  },
  {
    name: "MACD",
    code: `const { macd, signal: sinal, hist } = ta.macd(close, 12, 26, 9)

plot(hist, { title: "Hist", color: "#848e9c", type: "histogram", pane: "separate" })
plot(macd, { title: "MACD", color: "#2962ff", pane: "separate" })
plot(sinal, { title: "Sinal", color: "#f7a600", pane: "separate" })
`,
  },
]
