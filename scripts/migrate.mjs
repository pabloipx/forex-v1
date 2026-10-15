// Aplica as migrations da plataforma de futuros na ordem correta.
// Uso: node --env-file-if-exists=.env.local scripts/migrate.mjs
import { readFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import path from "node:path"
import pg from "pg"

const ORDER = [
  "400_platform_core.sql",
  "200_futures_trading.sql",
  "300_forex_admin.sql",
  "410_platform_triggers.sql",
]

const url = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL
if (!url) {
  console.error("Defina POSTGRES_URL_NON_POOLING (ou POSTGRES_URL).")
  process.exit(1)
}

const dir = path.dirname(fileURLToPath(import.meta.url))
const client = new pg.Client({ connectionString: url.replace(/[?&]sslmode=[^&]*/, ""), ssl: { rejectUnauthorized: false } })
await client.connect()
try {
  for (const file of ORDER) {
    const sql = await readFile(path.join(dir, file), "utf8")
    process.stdout.write(`-> ${file} ... `)
    await client.query(sql)
    console.log("ok")
  }
} finally {
  await client.end()
}
