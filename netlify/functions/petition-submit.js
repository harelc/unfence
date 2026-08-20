const crypto = require('crypto')

const hashIp = (ip) =>
  crypto.createHash('sha256').update(ip + 'unfence-salt').digest('hex')

const turso = async (dbUrl, authToken, requests) => {
  const res = await fetch(`${dbUrl}/v2/pipeline`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [...requests, { type: 'close' }] }),
  })
  if (!res.ok) throw new Error(`Turso HTTP error: ${res.status}`)
  const data = await res.json()
  for (const result of data.results ?? []) {
    if (result.type === 'error') {
      const err = new Error(result.error?.message || 'Turso statement error')
      err.code = result.error?.code || ''
      throw err
    }
  }
  return data
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  let body
  try {
    body = JSON.parse(event.body || '{}')
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid JSON' }) }
  }

  const name = (body.name || '').trim()
  const email = (body.email || '').trim().toLowerCase()
  const neighborhood = (body.neighborhood || '').trim()
  const hideName = body.hideName ? 1 : 0

  if (!name || !email || !email.includes('@')) {
    return { statusCode: 400, body: JSON.stringify({ error: 'שם ואימייל תקינים נדרשים' }) }
  }

  const dbUrl = (process.env.TURSO_DATABASE_URL || '').replace('libsql://', 'https://')
  const authToken = process.env.TURSO_AUTH_TOKEN || ''

  const rawIp = event.headers['x-forwarded-for']?.split(',')[0].trim()
    || event.headers['client-ip']
    || 'unknown'
  const ipHash = rawIp === 'unknown' ? 'unknown' : hashIp(rawIp)

  try {
    await turso(dbUrl, authToken, [
      {
        type: 'execute',
        stmt: {
          sql: `INSERT INTO signatures (name, email, neighborhood, hide_name, ip_hash, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))`,
          args: [
            { type: 'text', value: name },
            { type: 'text', value: email },
            { type: 'text', value: neighborhood },
            { type: 'integer', value: String(hideName) },
            { type: 'text', value: ipHash },
          ],
        },
      },
    ])
  } catch (e) {
    const msg = (e?.message || '') + (e?.code || '')
    if (msg.includes('UNIQUE') || msg.includes('SQLITE_CONSTRAINT') || msg.includes('2067')) {
      return { statusCode: 409, body: JSON.stringify({ error: 'כתובת האימייל הזו כבר חתמה על העצומה' }) }
    }
    console.error('petition-submit error:', msg)
    return { statusCode: 500, body: JSON.stringify({ error: 'שליחה נכשלה, נסו שוב' }) }
  }

  return { statusCode: 200, body: JSON.stringify({ success: true }) }
}
