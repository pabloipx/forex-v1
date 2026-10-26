import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google"

export const adminSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-admin-sans",
  display: "swap",
})

export const adminMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-admin-mono",
  display: "swap",
})
