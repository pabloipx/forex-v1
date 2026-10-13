"use client"

import React from "react"

/**
 * Minimal decorative background for the trading chart - Vollax style
 * Just a subtle center glow, very low opacity
 */
export function WorldMapBg() {
  return (
    <div
      className="absolute inset-0 flex items-center justify-center overflow-hidden"
      style={{ zIndex: 0, pointerEvents: "none", opacity: 0.03 }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 1200 600"
        className="w-full h-full"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#00E676" stopOpacity="0.08" />
            <stop offset="50%" stopColor="#00E676" stopOpacity="0.02" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* Subtle center glow only */}
        <ellipse cx="600" cy="300" rx="600" ry="350" fill="url(#centerGlow)" />
      </svg>
    </div>
  )
}

export default WorldMapBg
