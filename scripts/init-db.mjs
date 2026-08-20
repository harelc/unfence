#!/usr/bin/env node
import { createClient } from '@libsql/client'

const url = process.env.TURSO_DATABASE_URL || 'file:local.db'
const client = createClient({
  url,
  authToken: process.env.TURSO_AUTH_TOKEN,
})

async function initDb() {
  console.log(`Initializing database schema at: ${url}`)

  await client.execute(`
    CREATE TABLE IF NOT EXISTS signatures (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      neighborhood TEXT,
      hide_name INTEGER NOT NULL DEFAULT 0,
      ip_hash TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)

  console.log('✓ Created signatures table')
}

initDb().catch((err) => {
  console.error('✗ Failed to initialize database:', err)
  process.exit(1)
})
