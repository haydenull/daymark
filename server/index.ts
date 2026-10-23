import { OpenAPIHono } from '@hono/zod-openapi'
import { apiReference } from '@scalar/hono-api-reference'
import { serveStatic } from 'hono/bun'
import { HTTPException } from 'hono/http-exception'
import { logger } from 'hono/logger'

import { todo } from './api/todo'

const app = new OpenAPIHono()

app.use(logger())

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ code: err.status, message: err.message }, err.status)
  }
  console.error(err)
  return c.json({ code: 500, message: 'something wrong' }, 500)
})

app.get('/api/health', (c) => c.json({ ok: true }))

app.route('/', todo)

app.doc('/api/openapi.json', {
  openapi: '3.0.0',
  info: {
    title: 'Bun Fullstack Template API',
    version: '1.0.0',
    description: 'Bun Fullstack Template API',
  },
})

app.get(
  '/api/doc',
  apiReference({
    theme: 'deepSpace',
    pageTitle: 'Bun Fullstack Template API',
    spec: { url: '/api/openapi.json' },
  }),
)

app.get('*', serveStatic({ root: './dist' }))
app.get('*', serveStatic({ path: './dist/index.html' }))

console.log('Server is running on http://localhost:3000')

export type ServerAppAPI = typeof app

export default {
  port: 3000,
  fetch: app.fetch,
}
