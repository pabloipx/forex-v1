const BASE = "https://app.amplopay.com/api/v1";
const PUB = process.env.AMPLOPAY_PUBLIC_KEY || process.env.AMPLOPAY_CLIENT_ID || "";
const SEC = process.env.AMPLOPAY_SECRET_KEY || process.env.AMPLOPAY_CLIENT_SECRET || "";

const headers = {
  "Content-Type": "application/json",
  "x-public-key": PUB,
  "x-secret-key": SEC,
};

async function tryEndpoint(method, path, label) {
  try {
    const res = await fetch(`${BASE}${path}`, { method, headers });
    const text = await res.text();
    console.log(`\n${label} (${method} ${path})`);
    console.log(`Status: ${res.status}`);
    console.log(`Response: ${text.slice(0, 500)}`);
  } catch (e) {
    console.log(`\n${label} ERROR: ${e.message}`);
  }
}

async function main() {
  // Try various product/offer endpoints
  await tryEndpoint("GET", "/gateway/producer", "Producer info");
  await tryEndpoint("GET", "/gateway/products", "List products");
  await tryEndpoint("GET", "/gateway/offers", "List offers");
  await tryEndpoint("GET", "/gateway/producer/products", "Producer products");
  await tryEndpoint("GET", "/gateway/producer/offers", "Producer offers");
  await tryEndpoint("GET", "/products", "Products root");
  await tryEndpoint("GET", "/offers", "Offers root");
  
  // Also try without products array (maybe amount-only works)
  console.log("\n--- Testing PIX without products ---");
  const res = await fetch(`${BASE}/gateway/pix/receive`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      paymentMethod: "PIX",
      callbackUrl: "https://atlasinvest.pro/api/webhooks/amplopay",
      identifier: "test-" + Date.now(),
      client: {
        name: "Anthony Pedro Henrique Nicolas Barbosa",
        email: "anthony.pedro.barbosa@bb.com.br",
        phone: "91984355084",
        document: "84054702040",
      },
      amount: 50,
    }),
  });
  console.log(`Status: ${res.status}`);
  console.log(`Response: ${(await res.text()).slice(0, 500)}`);
}

main();
