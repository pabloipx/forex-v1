export type TermTheme = "light" | "dark"

export const TERM_THEME_COOKIE = "term-theme"

export function parseTermTheme(value: string | undefined): TermTheme {
  return value === "dark" ? "dark" : "light"
}

export const CHART_THEMES = {
  dark: {
    bg: "#131722",
    grid: "rgba(42, 46, 57, 0.6)",
    border: "#2a2e39",
    text: "#b2b5be",
    crosshair: "#758696",
    crosshairLabel: "#2a2e39",
    watermark: "rgba(178, 181, 190, 0.06)",
    handleFill: "#15181d",
  },
  light: {
    bg: "#ffffff",
    grid: "rgba(227, 231, 238, 0.8)",
    border: "#e3e7ee",
    text: "#4b5262",
    crosshair: "#9598a1",
    crosshairLabel: "#6a7180",
    watermark: "rgba(19, 23, 34, 0.05)",
    handleFill: "#ffffff",
  },
} as const

export type ChartTheme = (typeof CHART_THEMES)[TermTheme]
