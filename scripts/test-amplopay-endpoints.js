// Test AmploPay endpoints to find the correct one for PIX
const BASE = "https://app.amplopay.com/api/v1"
const PUBLIC_KEY = process.env.AMPLOPAY_PUBLIC_KEY || process.env.AMPLOPAY_CLIENT_ID || ""
const SECRET_KEY = process.env.AMPLOPAY_SECRET_KEY || process.env.AMPLOPAY_CLIENT_SECRET || ""

const headers = {
  "Content-Type": "application/json",
  "x-public-key": PUBLIC_KEY,
  "x-secret-key": SECRET_KEY,
}

const endpoints = [
  "/gateway/transaction",
  "/gateway/transactions",
  "/gateway/pix",
  "/gateway/pix/receive",
  "/gateway/checkout",
  "/gateway/checkout/pix",
  "/transactions",
  "/transaction",
  "/pix",
  "/pix/charge",
  "/checkout",
  "/checkout/pix",
]

const testPayload = {
  paymentMethod: "PIX",
  amount: 50,
  identifier: "test-" + Date.now(),
  callbackUrl: "https://www.atlasinvest.pro/api/webhook/amplopay",
  client: {
    name: "Anthony Pedro Henrique Nicolas Barbosa",
    email: "anthony.pedro.barbosa@bb.com.br",
    phone: "91984355084",
    document: "84054702040",
  },
  products: [
    {
      name: "Deposito Atlas Invest",
      quantity: 1,
      price: 50,
      externalId: "test-deposit",
    },
  ],
}

async function testEndpoints() {
  console.log("PUBLIC_KEY:", PUBLIC_KEY ? PUBLIC_KEY.slice(0, 8) + "..." : "NOT SET")
  console.log("SECRET_KEY:", SECRET_KEY ? SECRET_KEY.slice(0, 8) + "..." : "NOT SET")
  console.log("")

  // First test ping
  try {
    const pingRes = await fetch(`${BASE}/ping`, { headers })
    const pingText = await pingRes.text()
    console.log(`PING ${BASE}/ping -> ${pingRes.status}: ${pingText}`)
  } catch (e) {
    console.log(`PING failed: ${e.message}`)
  }

  console.log("")

  for (const ep of endpoints) {
    const url = `${BASE}${ep}`
    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(testPayload),
      })
      const text = await res.text()
      console.log(`POST ${ep} -> ${res.status}: ${text.slice(0, 200)}`)
      
      if (res.status !== 404) {
        console.log("  ^^^ POSSIBLE MATCH! Full response:", text.slice(0, 500))
      }
    } catch (e) {
      console.log(`POST ${ep} -> ERROR: ${e.message}`)
    }
    console.log("")
  }
}

testEndpoints().catch(console.error)
