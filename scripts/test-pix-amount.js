const BASE = "https://app.amplopay.com/api/v1"
const PUB = process.env.AMPLOPAY_PUBLIC_KEY || process.env.AMPLOPAY_CLIENT_ID || ""
const SEC = process.env.AMPLOPAY_SECRET_KEY || process.env.AMPLOPAY_CLIENT_SECRET || ""

const headers = {
  "Content-Type": "application/json",
  "x-public-key": PUB,
  "x-secret-key": SEC,
}

const client = {
  name: "Anthony Pedro Henrique Nicolas Barbosa",
  email: "anthony.pedro.barbosa@bb.com.br",
  phone: "91984355084",
  document: "84054702040",
}

async function test(label, amount) {
  console.log(`\n--- ${label} (amount=${amount}) ---`)
  try {
    const res = await fetch(`${BASE}/gateway/pix/receive`, {
      method: "POST",
      headers,
      body: JSON.stringify({ amount, callbackUrl: "https://www.atlasinvest.pro/api/webhook/amplopay", client }),
    })
    const text = await res.text()
    console.log(`Status: ${res.status}`)
    console.log(`Response: ${text.slice(0, 400)}`)
  } catch (e) {
    console.log(`Error: ${e.message}`)
  }
}

async function run() {
  // Test 1: amount in reais (50)
  await test("Reais inteiro", 50)
  // Test 2: amount in reais decimal (50.00)
  await test("Reais decimal", 50.00)
  // Test 3: amount in centavos (5000)
  await test("Centavos", 5000)
  // Test 4: amount as string "50.00"
  await test("String decimal", "50.00")
  // Test 5: amount as string "5000"
  await test("String centavos", "5000")
}

run()
