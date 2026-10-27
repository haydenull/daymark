import type { ChildProcess } from 'node:child_process'
import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { createConnection } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

function e2ePort(): number {
  const raw = process.env.E2E_PORT
  const port = Number(raw)
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`E2E_PORT 无效：${raw ?? '(未设置)'}`)
  }
  return port
}

let databaseDirectory: string | undefined
let activeChild: ChildProcess | undefined
let cleaned = false

function stopActiveChild(): void {
  const pid = activeChild?.pid
  if (!pid || activeChild?.exitCode !== null || activeChild?.signalCode !== null) return
  try {
    process.kill(-pid, 'SIGKILL')
  } catch {
    try {
      process.kill(pid, 'SIGKILL')
    } catch {
      // 进程已经退出。
    }
  }
}

function cleanup(): void {
  if (cleaned) return
  cleaned = true
  stopActiveChild()
  if (databaseDirectory) rmSync(databaseDirectory, { recursive: true, force: true })
}

function shutdown(exitCode: number): void {
  cleanup()
  process.exit(exitCode)
}

process.on('SIGINT', () => {
  shutdown(130)
})

process.on('SIGTERM', () => {
  shutdown(0)
})

function spawnBun(args: string[], env: NodeJS.ProcessEnv): ChildProcess {
  const child = spawn('bun', args, {
    env,
    stdio: 'inherit',
    detached: true,
  })
  activeChild = child
  return child
}

function runBun(args: string[], env: NodeJS.ProcessEnv): Promise<void> {
  const child = spawnBun(args, env)
  return new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('exit', (code, signal) => {
      if (cleaned) {
        resolve()
        return
      }
      if (code === 0) resolve()
      else reject(new Error(`bun ${args.join(' ')} 退出：${signal ?? code}`))
    })
  })
}

function canConnect(host: string, targetPort: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port: targetPort })
    const finish = (inUse: boolean) => {
      socket.destroy()
      resolve(inUse)
    }
    socket.setTimeout(1_000)
    socket.once('connect', () => finish(true))
    socket.once('timeout', () => finish(true))
    socket.once('error', () => finish(false))
  })
}

async function isPortInUse(targetPort: number): Promise<boolean> {
  const results = await Promise.all([canConnect('127.0.0.1', targetPort), canConnect('::1', targetPort)])
  return results.some(Boolean)
}

try {
  const port = e2ePort()
  const origin = `http://localhost:${port}`

  if (!existsSync('dist/index.html')) {
    throw new Error('缺少 dist/index.html。请先运行 bun run build:client。')
  }
  if (await isPortInUse(port)) {
    throw new Error(`端口 ${port} 已被占用。E2E 需要独占 ${origin}，不会关闭已有进程。`)
  }

  databaseDirectory = mkdtempSync(join(tmpdir(), 'daymark-e2e-'))
  const databaseFile = join(databaseDirectory, 'app.db')
  const disableRegistration = process.env.E2E_DISABLE_REGISTRATION === 'true'
  const env = {
    ...process.env,
    NODE_ENV: 'production',
    DB_FILE_NAME: databaseFile,
    BETTER_AUTH_URL: origin,
    BETTER_AUTH_SECRET: randomBytes(32).toString('base64'),
    E2E_PORT: String(port),
    // 显式写入，避免继承外部环境里的 DISABLE_REGISTRATION。
    DISABLE_REGISTRATION: disableRegistration ? 'true' : 'false',
  }

  console.error(`E2E origin: ${origin}`)
  console.error(`E2E database: ${databaseFile}`)
  console.error(`E2E registration: ${disableRegistration ? 'disabled' : 'open'}`)
  await runBun(['--no-env-file', 'run', 'db:migrate'], env)

  if (disableRegistration) {
    // 先用开放注册的独立进程写入已有账号，再启动禁用服务，共用同一临时库。
    await runBun(['--no-env-file', 'scripts/e2e-prepare-account.ts'], {
      ...env,
      DISABLE_REGISTRATION: 'false',
    })
  }

  // 测试入口 import 应用 default 后再 Bun.serve 覆写端口；生产 server/index.ts 启动行为不变。
  // 直接启动入口，保证 --preload 落在服务器进程里。`bun run start` 可能再起一层进程，时钟改写会丢失。
  // 预加载只改重要日子的无参 new Date()，不改全局时间，因此登录限流和会话有效期仍走真实时钟。
  // 禁用注册服务不加载时钟，避免和开放注册服务抢 3099。
  const serverArgs = disableRegistration
    ? ['--no-env-file', 'scripts/e2e-app.ts']
    : ['--no-env-file', '--preload', './scripts/e2e-clock.ts', 'scripts/e2e-app.ts']
  const serverEnv = disableRegistration ? env : { ...env, E2E_CLOCK: '1' }
  const server = spawnBun(serverArgs, serverEnv)
  server.once('error', (error) => {
    console.error(error)
    shutdown(1)
  })
  server.once('exit', (code, signal) => {
    if (cleaned) return
    console.error(`服务器退出：${signal ?? code}`)
    shutdown(code === 0 ? 0 : 1)
  })
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  shutdown(1)
}
