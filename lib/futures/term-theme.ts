export type TermTheme = "light" | "dark"

export const TERM_THEME_COOKIE = "term-theme"

export function parseTermTheme(value: string | undefined): TermTheme {
  return value === "dark" ? "dark" : "light"
}

export const CHART_THEMES = {
  dark: {
    bg: "#111216",
    grid: "rgba(37, 38, 43, 0.7)",
    border: "#25262b",
    text: "#a0a3a9",
    crosshair: "#6b6e75",
    crosshairLabel: "#2b2c31",
    watermark: "rgba(242, 243, 245, 0.05)",
    handleFill: "#111216",
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
