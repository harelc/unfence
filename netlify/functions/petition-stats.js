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
      throw new Error(result.error?.message || 'Turso statement error')
    }
  }
  return data
}

exports.handler = async () => {
  const dbUrl = (process.env.TURSO_DATABASE_URL || '').replace('libsql://', 'https://')
  const authToken = process.env.TURSO_AUTH_TOKEN || ''

  try {
    const data = await turso(dbUrl, authToken, [
      { type: 'execute', stmt: { sql: 'SELECT COUNT(*) as count FROM signatures' } },
      {
        type: 'execute',
        stmt: {
          sql: `SELECT name, neighborhood, hide_name FROM signatures ORDER BY created_at DESC LIMIT 8`,
        },
      },
    ])

    const countRow = data.results?.[0]?.response?.result?.rows?.[0]
    const count = countRow ? Number(countRow[0]?.value ?? 0) : 0

    const recentRows = data.results?.[1]?.response?.result?.rows ?? []
    const recent = recentRows.map((r) => {
      const hideName = Number(r[2]?.value ?? 0) === 1
      return {
        name: hideName ? 'חתימה אנונימית' : r[0]?.value || 'חתימה אנונימית',
        neighborhood: r[1]?.value || '',
      }
    })

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ count, recent }),
    }
  } catch (e) {
    console.error('petition-stats error:', e.message)
    return { statusCode: 200, body: JSON.stringify({ count: 0, recent: [] }) }
  }
}
