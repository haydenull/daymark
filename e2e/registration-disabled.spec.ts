import type { Page } from '@playwright/test'
import { expect, test } from '@playwright/test'

import {
  appOrigin,
  expectSignedIn,
  login,
  readMe,
  reserveAuthAttempt,
  responseBody,
  testPassword,
} from './helpers/auth'
import { existingAccount } from './helpers/registration-disabled-account'

async function expectLoginWithoutRegister(page: Page): Promise<void> {
  const nav = page.getByRole('navigation')
  await expect(nav.getByRole('link', { name: '登录', exact: true })).toBeVisible()
  await expect(nav.getByRole('link', { name: '注册', exact: true })).toHaveCount(0)
}

test.describe('禁用注册', () => {
  test.describe.configure({ timeout: 60_000 })

  test('公开配置关闭注册，导航隐藏注册并保留登录', async ({ page, request }) => {
    const config = await request.get('/api/config')
    const publicConfig: unknown = await config.json()
    expect(config.status(), JSON.stringify(publicConfig)).toBe(200)
    expect(publicConfig).toEqual({ registrationOpen: false })

    const pendingConfig = page.waitForResponse(
      (response) => new URL(response.url()).pathname === '/api/config' && response.request().method() === 'GET',
    )
    await page.goto('/')
    await pendingConfig
    await expectLoginWithoutRegister(page)
  })

  test('直接访问注册页显示已关闭且无表单', async ({ page }) => {
    await page.goto('/register')
    const main = page.getByRole('main')
    await expect(page.getByRole('heading', { name: '注册' })).toBeVisible()
    await expect(main.getByText('注册已关闭', { exact: true })).toBeVisible()
    await expect(main.getByRole('form')).toHaveCount(0)
    await expect(main.getByLabel('昵称')).toHaveCount(0)
    await expect(main.getByLabel('邮箱')).toHaveCount(0)
    await expect(main.getByLabel('密码')).toHaveCount(0)
    await expect(main.getByRole('button', { name: '注册', exact: true })).toHaveCount(0)
    await expectLoginWithoutRegister(page)
  })

  test('真实注册接口被拒绝且不建立会话', async ({ playwright }) => {
    await reserveAuthAttempt('sign-up')
    const origin = appOrigin()
    const api = await playwright.request.newContext({
      baseURL: origin,
      extraHTTPHeaders: { Origin: origin },
    })
    try {
      const response = await api.post('/api/auth/sign-up/email', {
        data: {
          name: 'e2e-closed',
          email: `e2e-closed-${crypto.randomUUID()}@example.com`,
          password: testPassword,
        },
      })
      const outcome = responseBody(response.status(), await response.text())
      expect(outcome.status, JSON.stringify(outcome.body)).not.toBe(429)
      expect(outcome.status, JSON.stringify(outcome.body)).toBe(400)
      expect(outcome.body).toEqual(
        expect.objectContaining({
          code: 'EMAIL_PASSWORD_SIGN_UP_DISABLED',
        }),
      )

      const me = await readMe(api)
      expect(me.status, JSON.stringify(me.body)).toBe(401)
    } finally {
      await api.dispose()
    }
  })

  test('关闭前账号仍可登录且刷新保持会话', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByRole('heading', { name: '登录' })).toBeVisible()
    await login(page, existingAccount)
    await page.reload()
    await expectSignedIn(page, existingAccount)
  })
})
