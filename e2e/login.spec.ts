import type { Page, Route } from '@playwright/test'
import { expect, test } from '@playwright/test'

import {
  createGate,
  expectAnonymous,
  expectSignedIn,
  fillLogin,
  isSignInPost,
  login,
  loginButton,
  openLogin,
  origin,
  readMe,
  registerAccount,
  reserveAuthAttempt,
  responseBody,
  signOut,
  submitAndWaitForSignIn,
  testPassword,
} from './helpers/auth'
import { setServerClock } from './helpers/clock'

const signInPath = '**/api/auth/sign-in/email'

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

  test.beforeEach(async () => {
    await setServerClock(null)
  })

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

    await signOut(page)
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
