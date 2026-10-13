"use client"

interface TimeframeSelectorProps {
  timeframe: number
  onChange: (tf: number) => void
}

const TIMEFRAMES = [
  { label: "5s", value: 5 },
  { label: "15s", value: 15 },
  { label: "30s", value: 30 },
  { label: "1m", value: 60 },
  { label: "5m", value: 300 },
]

export function TimeframeSelector({ timeframe, onChange }: TimeframeSelectorProps) {
  return (
    <div className="flex gap-1 bg-[#121826] border border-[#1f2933] rounded-lg p-1">
      {TIMEFRAMES.map((tf) => (
        <button
          key={tf.value}
          onClick={() => onChange(tf.value)}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
            timeframe === tf.value ? "bg-[#f97316] text-white" : "text-[#9CA3AF] hover:text-white hover:bg-[#1f2933]"
          }`}
        >
          {tf.label}
        </button>
      ))}
    </div>
  )
}
