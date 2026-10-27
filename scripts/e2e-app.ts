import app from '../server/index'

function e2ePort(): number {
  const raw = process.env.E2E_PORT
  const port = Number(raw)
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`E2E_PORT 无效：${raw ?? '(未设置)'}`)
  }
  return port
}

const server = Bun.serve({
  ...app,
  port: e2ePort(),
})

console.error(`E2E app: http://localhost:${server.port}`)
