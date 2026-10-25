import type { APIRequestContext, Locator, Page, PlaywrightWorkerArgs, Route } from '@playwright/test'
import { expect, test } from '@playwright/test'

const origin = 'http://localhost:3000'
const signInPath = '**/api/auth/sign-in/email'
const testPassword = 'daymark-e2e-password'

// production 下 better-auth 对 /sign-in 与 /sign-up 分路径计数：10 秒最多 3 次。
// 窗口从最近一次放行的请求起算，不是按最早一次请求滑动。429 不能当成凭据错误。
const authWindowMs = 10_000
const authMaxPerWindow = 3
const authBuckets: Record<'sign-in' | 'sign-up', { count: number; lastAt: number }> = {
  'sign-in': { count: 0, lastAt: 0 },
  'sign-up': { count: 0, lastAt: 0 },
}

type Account = {
  email: string
  name: string
  password: string
}

type ResponseBody = {
  status: number
  body: unknown
}

function responseBody(status: number, text: string): ResponseBody {
  try {
    return { status, body: JSON.parse(text) as unknown }
  } catch {
    return { status, body: text }
  }
}

function createGate(): { wait: () => Promise<void>; release: () => void } {
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

async function reserveAuthAttempt(kind: 'sign-in' | 'sign-up'): Promise<void> {
  const bucket = authBuckets[kind]
  for (;;) {
    const now = Date.now()
    const elapsed = now - bucket.lastAt
    if (bucket.count >= authMaxPerWindow && elapsed < authWindowMs) {
      await new Promise((resolve) => setTimeout(resolve, authWindowMs - elapsed + 500))
      continue
    }
    bucket.count = bucket.count === 0 || elapsed >= authWindowMs ? 1 : bucket.count + 1
    bucket.lastAt = now
    return
  }
}

async function registerAccount(playwright: PlaywrightWorkerArgs['playwright']): Promise<Account> {
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

async function readMe(request: APIRequestContext): Promise<ResponseBody> {
  const response = await request.get('/api/me')
  return responseBody(response.status(), await response.text())
}

function loginButton(page: Page): Locator {
  return page.getByRole('main').getByRole('button', { name: '登录', exact: true })
}

async function expectAnonymous(page: Page): Promise<void> {
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

async function expectSignedIn(page: Page, account: Account): Promise<void> {
  await expect(page).toHaveURL(`${origin}/`)
  await expect(page.getByRole('heading', { name: 'Bun Fullstack Template' })).toBeVisible()
  await expect(page.getByRole('navigation').getByText(account.name, { exact: true })).toBeVisible()
  await expectCurrentUser(page.request, account)
}

async function openLogin(page: Page): Promise<void> {
  await page.goto('/login')
  await expectAnonymous(page)
}

async function fillLogin(page: Page, email: string, password: string): Promise<void> {
  await page.getByRole('main').getByLabel('邮箱').fill(email)
  await page.getByRole('main').getByLabel('密码').fill(password)
}

function isSignInPost(response: { url: () => string; request: () => { method: () => string } }): boolean {
  return response.url().includes('/api/auth/sign-in/email') && response.request().method() === 'POST'
}

async function submitAndWaitForSignIn(page: Page): Promise<ResponseBody> {
  await reserveAuthAttempt('sign-in')
  const responsePromise = page.waitForResponse(isSignInPost)
  await loginButton(page).click()
  const response = await responsePromise
  return responseBody(response.status(), await response.text())
}

async function login(page: Page, account: Account, email = account.email): Promise<void> {
  await fillLogin(page, email, account.password)
  const outcome = await submitAndWaitForSignIn(page)
  expect(outcome.status, JSON.stringify(outcome.body)).not.toBe(429)
  expect(outcome.status, JSON.stringify(outcome.body)).toBe(200)
  await expectSignedIn(page, account)
}

async function rejectLogin(page: Page, email: string, password: string): Promise<void> {
  await fillLogin(page, email, password)
  const outcome = await submitAndWaitForSignIn(page)
  expect(outcome.status, JSON.stringify(outcome.body)).not.toBe(429)
  expect(outcome.status, JSON.stringify(outcome.body)).toBe(401)
  await expect(page.getByRole('main').getByText('邮箱或密码不正确', { exact: true })).toBeVisible()
  await expect(page).toHaveURL(`${origin}/login`)
  await expect(page.getByRole('heading', { name: '登录' })).toBeVisible()
  await expect(loginButton(page)).toBeEnabled()
  await expectAnonymous(page)
}

test.describe('登录', () => {
  test.describe.configure({ timeout: 60_000 })

  test('正确账号登录后跳转首页，刷新仍保持会话', async ({ page, playwright }) => {
    const account = await registerAccount(playwright)
    await openLogin(page)
    await login(page, account)

    await page.reload()
    await expectSignedIn(page, account)
  })

  test('错误密码与未注册邮箱都停留在登录页', async ({ page, playwright }) => {
    const account = await registerAccount(playwright)
    await openLogin(page)
    await rejectLogin(page, account.email, 'daymark-e2e-wrong')
    await rejectLogin(page, `missing-${crypto.randomUUID()}@example.com`, account.password)
  })

  test('非法邮箱和密码长度在本地校验，不发送登录请求', async ({ page }) => {
    await openLogin(page)
    let signInPosts = 0
    const handler = async (route: Route) => {
      if (route.request().method() === 'POST') signInPosts += 1
      await route.continue()
    }
    await page.route(signInPath, handler)

    try {
      const cases = [
        { email: 'not-an-email', password: testPassword, message: '请输入有效的邮箱' },
        { email: 'user@example.com', password: '1234567', message: '密码至少 8 位' },
        { email: 'user@example.com', password: 'x'.repeat(129), message: '密码不能超过 128 位' },
      ]

      for (const item of cases) {
        await fillLogin(page, item.email, item.password)
        await loginButton(page).click()
        // 校验提示只在提交函数返回之后渲染，而返回发生在调用登录接口之前。
        await expect(page.getByRole('main').getByText(item.message, { exact: true })).toBeVisible()
        for (const other of cases) {
          if (other.message === item.message) continue
          await expect(page.getByRole('main').getByText(other.message, { exact: true })).toHaveCount(0)
        }
        await expect(loginButton(page)).toBeEnabled()
        await expect(page).toHaveURL(`${origin}/login`)
        expect(signInPosts).toBe(0)
      }
    } finally {
      await page.unroute(signInPath, handler)
    }
  })

  test('合法邮箱首尾空格会被去掉后登录', async ({ page, playwright }) => {
    const account = await registerAccount(playwright)
    let submittedEmail = ''
    const handler = async (route: Route) => {
      if (route.request().method() === 'POST') {
        const payload: unknown = route.request().postDataJSON()
        if (!payload || typeof payload !== 'object' || !('email' in payload) || typeof payload.email !== 'string') {
          throw new Error('登录请求缺少邮箱')
        }
        submittedEmail = payload.email
      }
      await route.continue()
    }
    await page.route(signInPath, handler)

    try {
      await openLogin(page)
      await login(page, account, `  ${account.email}  `)
      expect(submittedEmail).toBe(account.email)
    } finally {
      await page.unroute(signInPath, handler)
    }
  })

  test('登录请求未完成时重复点击不会再次提交', async ({ page, playwright }) => {
    const account = await registerAccount(playwright)
    await openLogin(page)
    await fillLogin(page, account.email, account.password)

    const gate = createGate()
    let signInPosts = 0
    let markIntercepted = (): void => {}
    const intercepted = new Promise<void>((resolve) => {
      markIntercepted = resolve
    })
    const handler = async (route: Route) => {
      if (route.request().method() !== 'POST') {
        await route.continue()
        return
      }
      signInPosts += 1
      markIntercepted()
      await gate.wait()
      await route.continue()
    }

    await page.route(signInPath, handler)
    try {
      await reserveAuthAttempt('sign-in')
      // 请求被挂起时客户端导航不会发生，不能让这次点击一直等导航。
      await loginButton(page).click({ noWaitAfter: true })
      await intercepted

      const pendingButton = page.getByRole('main').getByRole('button', { name: '登录中...', exact: true })
      await expect(pendingButton).toBeDisabled()
      const box = await pendingButton.boundingBox()
      if (!box) throw new Error('登录中按钮没有可点击区域')
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            requestAnimationFrame(() => resolve())
          }),
      )
      expect(signInPosts).toBe(1)

      const responsePromise = page.waitForResponse(isSignInPost)
      gate.release()
      const response = await responsePromise
      const outcome = responseBody(response.status(), await response.text())
      expect(outcome.status, JSON.stringify(outcome.body)).not.toBe(429)
      expect(outcome.status, JSON.stringify(outcome.body)).toBe(200)
      await expectSignedIn(page, account)
    } finally {
      gate.release()
      await page.unrouteAll({ behavior: 'wait' }).catch(() => undefined)
    }
  })

  test('网络失败后可以重新登录', async ({ page, playwright }) => {
    const account = await registerAccount(playwright)
    await openLogin(page)
    await fillLogin(page, account.email, account.password)

    let aborted = 0
    const handler = async (route: Route) => {
      if (route.request().method() !== 'POST') {
        await route.continue()
        return
      }
      aborted += 1
      await route.abort('failed')
    }
    await page.route(signInPath, handler)
    try {
      await loginButton(page).click()
      await expect(page.getByRole('main').getByText('网络异常，请稍后重试', { exact: true })).toBeVisible()
      await expect(loginButton(page)).toBeEnabled()
      await expect(page).toHaveURL(`${origin}/login`)
      expect(aborted).toBe(1)
      await expectAnonymous(page)
    } finally {
      await page.unroute(signInPath, handler)
    }

    await login(page, account)
  })

  test('退出后旧会话 cookie 在服务端失效', async ({ page, playwright }) => {
    const account = await registerAccount(playwright)
    await openLogin(page)
    await login(page, account)

    const savedCookies = await page.context().cookies()
    const sessionCookie = savedCookies.find((cookie) => cookie.name.endsWith('session_token'))
    if (!sessionCookie?.value) throw new Error('登录后缺少 session_token cookie')

    await page.getByRole('navigation').getByRole('button', { name: '退出', exact: true }).click()
    await expectAnonymous(page)
    await page.reload()
    await expectAnonymous(page)

    const replay = await playwright.request.newContext({
      baseURL: origin,
      storageState: { cookies: savedCookies, origins: [] },
    })
    try {
      const stored = await replay.storageState()
      expect(stored.cookies).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            name: sessionCookie.name,
            value: sessionCookie.value,
          }),
        ]),
      )
      const me = await readMe(replay)
      expect(me.status, JSON.stringify(me.body)).toBe(401)
    } finally {
      await replay.dispose()
    }
  })
})
