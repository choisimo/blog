import { Hono } from 'hono'
import { cors } from 'hono/cors'

export type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', cors())

app.get('/api/v1/healthz', (c) => {
  return c.json({ ok: true, env: 'production', ts: Date.now() })
})

app.get('/api/v1/posts', async (c) => {
  try {
    const { results } = await c.env.DB
      .prepare(
        `SELECT slug, title, description, date, year, tags, category
         FROM posts
         WHERE published = 1
         ORDER BY date DESC
         LIMIT 50`
      )
      .all()
    return c.json({ ok: true, items: results ?? [] })
  } catch (e) {
    const msg = (e as Error)?.message || 'Query failed'
    return c.json({ ok: false, error: msg }, 500)
  }
})

app.get('/api/v1/posts/:slug', async (c) => {
  const slug = c.req.param('slug')
  try {
    const { results } = await c.env.DB
      .prepare(
        `SELECT slug, title, description, date, year, tags, category, content
         FROM posts WHERE slug = ? LIMIT 1`
      )
      .bind(slug)
      .all()
    const item = results?.[0]
    if (!item) return c.json({ ok: false, error: 'Not Found' }, 404)
    return c.json({ ok: true, item })
  } catch (e) {
    const msg = (e as Error)?.message || 'Query failed'
    return c.json({ ok: false, error: msg }, 500)
  }
})

export default app
