const CARD =
  "rounded-2xl border border-iv-line/80 bg-gradient-to-b from-iv-card via-iv-card/90 to-iv-card/50"

export function ChartSkeleton({ variant }: { variant: "donut" | "area" }) {
  if (variant === "donut") {
    return (
      <div className={`${CARD} flex flex-col items-center gap-6 p-5 sm:flex-row sm:gap-8 sm:p-6`} aria-hidden>
        <div className="aspect-square w-full max-w-[290px] shrink-0 animate-pulse rounded-full border-[40px] border-iv-line/40 sm:w-[44%]" />
        <div className="flex w-full flex-1 flex-col gap-5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-5 animate-pulse rounded bg-iv-line/40" />
          ))}
        </div>
      </div>
    )
  }
  return (
    <div className={`${CARD} flex flex-col gap-4 p-5 sm:p-6`} aria-hidden>
      <div className="h-7 w-56 animate-pulse rounded bg-iv-line/40" />
      <div className="h-64 animate-pulse rounded-xl bg-iv-line/25 sm:h-72" />
    </div>
  )
}
