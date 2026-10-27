import type { IncomingMessage } from 'node:http'
import { createServer } from 'node:http'
import { plugin } from 'bun'

import { e2eClockOrigin, e2eClockPort } from '../e2e/clock-port'

// 不替换全局 Date。better-auth 的会话有效期和登录限流都读真实时间，
// 全局冻结会让 10 秒 3 次的限额窗口停住，或在日期回拨后把会话提前判过期。
// 仅在 E2E 预加载时改写重要日子和 Token 的业务时钟。
const clockedNow = 'new Date(globalThis.__e2eImportantDayEpoch ?? Date.now())'
const clockGlobal = globalThis as typeof globalThis & {
  __e2eImportantDayEpoch?: number | null
}

clockGlobal.__e2eImportantDayEpoch = null

if (process.env.E2E_CLOCK === '1') {
  await plugin({
    name: 'e2e-important-day-clock',
    setup(build) {
      build.onLoad(
        { filter: /\/server\/(?:api\/(?:important-day|token)|important-day\/calendar|api-token)\.ts$/ },
        async (args) => {
          const source = await Bun.file(args.path).text()
          const contents = args.path.endsWith('/server/api-token.ts')
            ? source.replaceAll('Date.now()', '(globalThis.__e2eImportantDayEpoch ?? Date.now())')
            : source.replaceAll('new Date()', clockedNow)
          if (contents === source) {
            throw new Error(`E2E 时钟没有改写 ${args.path} 里的业务时钟。`)
          }
          console.error(`E2E clock patched ${args.path}`)
          return { contents, loader: 'ts' }
        },
      )
    },
  })

  const server = createServer((request, response) => {
    if (request.method === 'GET' && request.url === '/clock') {
      response.setHeader('content-type', 'application/json')
      response.end(JSON.stringify({ epochMs: clockGlobal.__e2eImportantDayEpoch ?? null }))
      return
    }
    if (request.method === 'POST' && request.url === '/clock') {
      void readBody(request)
        .then((body) => {
          clockGlobal.__e2eImportantDayEpoch = epochFromBody(body)
          response.setHeader('content-type', 'application/json')
          response.end(JSON.stringify({ epochMs: clockGlobal.__e2eImportantDayEpoch }))
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : '无法设置时钟'
          response.writeHead(400, { 'content-type': 'application/json' })
          response.end(JSON.stringify({ message }))
        })
      return
    }
    response.writeHead(404)
    response.end()
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(e2eClockPort, '127.0.0.1', () => resolve())
  })
  server.unref()
  console.error(`E2E clock: ${e2eClockOrigin}/clock`)
}

function readBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = ''
    request.setEncoding('utf8')
    request.on('data', (chunk: string) => {
      body += chunk
      if (body.length > 256) {
        reject(new Error('时钟请求过大'))
        request.pause()
      }
    })
    request.on('end', () => resolve(body))
    request.on('error', reject)
  })
}

function epochFromBody(body: string): number | null {
  const parsed: unknown = JSON.parse(body)
  if (!parsed || typeof parsed !== 'object' || !('epochMs' in parsed)) {
    throw new Error('缺少 epochMs')
  }
  const epochMs = (parsed as { epochMs: unknown }).epochMs
  if (epochMs === null) return null
  if (typeof epochMs !== 'number' || !Number.isFinite(epochMs)) {
    throw new Error('epochMs 必须是有限数字或 null')
  }
  return epochMs
}
