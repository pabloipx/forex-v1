import Image from "next/image"

export function AffiliateBrand({ className = "h-7" }: { className?: string }) {
  return (
    <span className="inline-flex items-center rounded-md bg-[#0B1220] px-2 py-1">
      <Image
        src="/images/kryptobit-logo.png"
        alt="Kryptobit"
        width={1500}
        height={400}
        priority
        className={`${className} w-auto`}
      />
    </span>
  )
}
