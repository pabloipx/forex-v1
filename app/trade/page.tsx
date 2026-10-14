import { permanentRedirect } from "next/navigation"

export default function TradeRedirectPage() {
  permanentRedirect("/futures")
}
