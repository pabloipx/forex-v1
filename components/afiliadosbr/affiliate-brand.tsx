import Image from "next/image"

export function AffiliateBrand({ className = "h-7" }: { className?: string }) {
  return (
    <span className="inline-flex items-center">
      <Image
        src="/images/ptg-logo.svg"
        alt="Profit Trading Global"
        width={1500}
        height={400}
        priority
        className={`${className} w-auto`}
      />
    </span>
  )
}
