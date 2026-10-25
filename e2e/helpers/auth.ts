import { closeSync, mkdirSync, openSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { APIRequestContext, Locator, Page, PlaywrightWorkerArgs } from '@playwright/test'
import { expect } from '@playwright/test'

export const origin = 'http://localhost:3000'
export const testPassword = 'daymark-e2e-password'

// production 下 better-auth 对 /sign-in 与 /sign-up 分路径计数：10 秒最多 3 次。
// 窗口从最近一次放行的请求起算。计数放在临时文件里，同一台机器上的多个 worker 共用，
// 避免每个文件各记一份内存计数后把 429 当成登录或注册失败。
const authWindowMs = 10_000
const authMaxPerWindow = 3
const statePath = join(tmpdir(), 'daymark-e2e-auth-limit.json')
const lockPath = `${statePath}.lock`

type AuthKind = 'sign-in' | 'sign-up'
type Bucket = { count: number; lastAt: number }
type AuthState = Record<AuthKind, Bucket>

export type Account = {
  email: string
  name: string
  password: string
}

type ResponseBody = {
  status: number
  body: unknown
}

export function responseBody(status: number, text: string): ResponseBody {
  try {
    return { status, body: JSON.parse(text) as unknown }
  } catch {
    return { status, body: text }
  }
}

export function createGate(): { wait: () => Promise<void>; release: () => void } {
  let resolveGate = (): void => {}
  let released = false
  const opened = new Promise<void>((resolve) => {
    resolveGate = resolve
  })

  return {
    wait: () => opened,
    release: () => {
      if (released) return
      released = true
      resolveGate()
    },
  }
}

export async function reserveAuthAttempt(kind: AuthKind): Promise<void> {
  while (true) {
    const waitMs = withAuthLock(() => {
      const state = readAuthState()
      const bucket = state[kind]
      const now = Date.now()
      const elapsed = now - bucket.lastAt
      if (bucket.count >= authMaxPerWindow && elapsed < authWindowMs) {
        return authWindowMs - elapsed + 500
      }
      bucket.count = bucket.count === 0 || elapsed >= authWindowMs ? 1 : bucket.count + 1
      bucket.lastAt = now
      writeAuthState(state)
      return 0
    })
    if (waitMs === 0) return
    await new Promise((resolve) => setTimeout(resolve, waitMs))
  }
}

export async function registerAccount(playwright: PlaywrightWorkerArgs['playwright']): Promise<Account> {
  const id = crypto.randomUUID()
  const account: Account = {
    email: `e2e-${id}@example.com`,
    name: `n-${id.slice(0, 8)}`,
    password: testPassword,
  }

  await reserveAuthAttempt('sign-up')
  const api = await playwright.request.newContext({
    baseURL: origin,
    extraHTTPHeaders: { Origin: origin },
  })
  try {
    const response = await api.post('/api/auth/sign-up/email', {
      data: {
        name: account.name,
        email: account.email,
        password: account.password,
      },
    })
    const body = await response.text()
    if (response.status() === 429) {
      throw new Error(`注册被生产限流（429），不是注册业务失败：${body}`)
    }
    if (!response.ok()) {
      throw new Error(`注册失败：${response.status()} ${body}`)
    }
    return account
  } finally {
    await api.dispose()
  }
}

export async function readMe(request: APIRequestContext): Promise<ResponseBody> {
  const response = await request.get('/api/me')
  return responseBody(response.status(), await response.text())
}

export function loginButton(page: Page): Locator {
  return page.getByRole('main').getByRole('button', { name: '登录', exact: true })
}

export async function expectAnonymous(page: Page): Promise<void> {
  const nav = page.getByRole('navigation')
  await expect(nav.getByRole('link', { name: '登录', exact: true })).toBeVisible()
  await expect(nav.getByRole('link', { name: '注册', exact: true })).toBeVisible()
  await expect(nav.getByRole('button', { name: '退出', exact: true })).toHaveCount(0)
  const me = await readMe(page.request)
  expect(me.status, JSON.stringify(me.body)).toBe(401)
}

async function expectCurrentUser(request: APIRequestContext, account: Account): Promise<void> {
  const me = await readMe(request)
  expect(me.status, JSON.stringify(me.body)).toBe(200)
  expect(me.body).toEqual({
    id: expect.any(String),
    email: account.email,
    name: account.name,
  })
}

export async function expectSignedIn(page: Page, account: Account): Promise<void> {
  await expect(page).toHaveURL(`${origin}/`)
  await expect(page.getByRole('heading', { name: 'Bun Fullstack Template' })).toBeVisible()
  await expect(page.getByRole('navigation').getByText(account.name, { exact: true })).toBeVisible()
  await expectCurrentUser(page.request, account)
}

export async function openLogin(page: Page): Promise<void> {
  await page.goto('/login')
  await expectAnonymous(page)
}

export async function fillLogin(page: Page, email: string, password: string): Promise<void> {
  await page.getByRole('main').getByLabel('邮箱').fill(email)
  await page.getByRole('main').getByLabel('密码').fill(password)
}

export function isSignInPost(response: { url: () => string; request: () => { method: () => string } }): boolean {
  return response.url().includes('/api/auth/sign-in/email') && response.request().method() === 'POST'
}

export async function submitAndWaitForSignIn(page: Page): Promise<ResponseBody> {
  await reserveAuthAttempt('sign-in')
  const responsePromise = page.waitForResponse(isSignInPost)
  await loginButton(page).click()
  const response = await responsePromise
  return responseBody(response.status(), await response.text())
}

export async function login(page: Page, account: Account, email = account.email): Promise<void> {
  await fillLogin(page, email, account.password)
  const outcome = await submitAndWaitForSignIn(page)
  expect(outcome.status, JSON.stringify(outcome.body)).not.toBe(429)
  expect(outcome.status, JSON.stringify(outcome.body)).toBe(200)
  await expectSignedIn(page, account)
}

export async function signOut(page: Page): Promise<void> {
  await page.getByRole('navigation').getByRole('button', { name: '退出', exact: true }).click()
  await expectAnonymous(page)
}

function emptyAuthState(): AuthState {
  return {
    'sign-in': { count: 0, lastAt: 0 },
    'sign-up': { count: 0, lastAt: 0 },
  }
}

function isBucket(value: unknown): value is Bucket {
  if (!value || typeof value !== 'object') return false
  const bucket = value as { count?: unknown; lastAt?: unknown }
  return typeof bucket.count === 'number' && typeof bucket.lastAt === 'number'
}

function readAuthState(): AuthState {
  try {
    const parsed: unknown = JSON.parse(readFileSync(statePath, 'utf8'))
    if (!parsed || typeof parsed !== 'object') return emptyAuthState()
    const state = parsed as Partial<AuthState>
    if (!isBucket(state['sign-in']) || !isBucket(state['sign-up'])) return emptyAuthState()
    return { 'sign-in': state['sign-in'], 'sign-up': state['sign-up'] }
  } catch {
    return emptyAuthState()
  }
}

function writeAuthState(state: AuthState): void {
  mkdirSync(tmpdir(), { recursive: true })
  const temporary = `${statePath}.${process.pid}.tmp`
  writeFileSync(temporary, JSON.stringify(state))
  renameSync(temporary, statePath)
}

function withAuthLock<T>(fn: () => T): T {
  mkdirSync(tmpdir(), { recursive: true })
  while (true) {
    try {
      closeSync(openSync(lockPath, 'wx'))
      break
    } catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined
      if (code !== 'EEXIST') throw error
      try {
        if (Date.now() - statSync(lockPath).mtimeMs > 30_000) unlinkSync(lockPath)
      } catch {
        // 锁已经消失，或正在被其他进程接走。
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 20)
    }
  }

  try {
    return fn()
  } finally {
    try {
      unlinkSync(lockPath)
    } catch {
      // 进程退出时锁可能已经被清掉。
    }
  }
}
