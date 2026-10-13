const PUBLIC_KEY = process.env.AMPLOPAY_PUBLIC_KEY || process.env.AMPLOPAY_CLIENT_ID || ""
const SECRET_KEY = process.env.AMPLOPAY_SECRET_KEY || process.env.AMPLOPAY_CLIENT_SECRET || ""
const BASE = "https://app.amplopay.com/api/v1"

async function testPix() {
  const payload = {
    paymentMethod: "PIX",
    callbackUrl: "https://atlasinvest.pro/api/webhooks/amplopay",
    identifier: "test-" + Date.now(),
    client: {
      name: "Anthony Pedro Henrique Nicolas Barbosa",
      email: "anthony.pedro.barbosa@bb.com.br",
      phone: "91984355084",
      document: "84054702040",
    },
    products: [
      {
        id: "deposit-pix",
        name: "Deposito PIX",
        price: 50,
        quantity: 1,
      }
    ],
    shippingFee: 0,
    extraFee: 0,
    discount: 0,
    amount: 50,
  }

  console.log("Testing POST /gateway/pix/receive with full payload...")
  console.log("Payload:", JSON.stringify(payload, null, 2))

  const res = await fetch(`${BASE}/gateway/pix/receive`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-public-key": PUBLIC_KEY,
      "x-secret-key": SECRET_KEY,
    },
    body: JSON.stringify(payload),
  })

  const text = await res.text()
  console.log(`\nStatus: ${res.status}`)
  console.log("Response:", text)
}

testPix().catch(console.error)
