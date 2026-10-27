import type { APIRequestContext, Locator, Page, PlaywrightWorkerArgs, Request } from '@playwright/test'
import { expect, test } from '@playwright/test'

import type { CreatedApiTokenResponse } from '../shared/schema/api-token'
import type { Account } from './helpers/auth'
import { appOrigin, login, openLogin, registerAccount, signOut } from './helpers/auth'
import { setServerClock } from './helpers/clock'

type Playwright = PlaywrightWorkerArgs['playwright']

async function signIn(page: Page, playwright: Playwright): Promise<Account> {
  const account = await registerAccount(playwright)
  await openLogin(page)
  await login(page, account)
  return account
}

async function openTokenPage(page: Page): Promise<void> {
  await page.goto('/api-tokens')
}

async function openTokenPageFromNav(page: Page): Promise<void> {
  await page.getByRole('navigation').getByRole('link', { name: 'API Token' }).click()
}

async function signInOnTokenPage(page: Page, playwright: Playwright): Promise<Account> {
  const account = await signIn(page, playwright)
  await openTokenPage(page)
  return account
}

function tokenItem(page: Page, name: string): Locator {
  return page.getByRole('listitem').filter({ has: page.getByText(name, { exact: true }) })
}

function tokenSecretInput(page: Page): Locator {
  return page.getByLabel('令牌', { exact: true })
}

async function createToken(page: Page, name: string): Promise<CreatedApiTokenResponse> {
  await page.getByLabel('名称', { exact: true }).fill(name)
  const pending = page.waitForResponse(
    (response) => new URL(response.url()).pathname === '/api/token' && response.request().method() === 'POST',
  )
  await page.getByRole('button', { name: '创建', exact: true }).click()
  const response = await pending
  expect(response.status()).toBe(200)
  const token: CreatedApiTokenResponse = await response.json()
  await expect(tokenSecretInput(page)).toHaveValue(token.token)
  await expect(tokenItem(page, name.trim())).toBeVisible()
  return token
}

async function expectStatus(request: APIRequestContext, status: number): Promise<void> {
  expect((await request.get('/api/me')).status()).toBe(status)
}

async function expectCreateRejected(page: Page, name: string, error: string): Promise<void> {
  let posts = 0
  const onRequest = (request: Request) => {
    if (new URL(request.url()).pathname === '/api/token' && request.method() === 'POST') posts += 1
  }
  page.on('request', onRequest)
  try {
    await page.getByLabel('名称', { exact: true }).fill(name)
    await page.getByRole('button', { name: '创建', exact: true }).click()
    await expect(page.getByText(error, { exact: true })).toBeVisible()
    await expect(page.getByText('还没有 API Token')).toBeVisible()
    expect(posts).toBe(0)
  } finally {
    page.off('request', onRequest)
  }
}

async function withBearer(
  playwright: Playwright,
  token: string,
  run: (api: APIRequestContext) => Promise<void>,
): Promise<void> {
  const api = await playwright.request.newContext({
    baseURL: appOrigin(),
    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
  })
  try {
    await run(api)
  } finally {
    await api.dispose()
  }
}

test.describe('API Token', () => {
  test.describe.configure({ timeout: 60_000 })
  test.beforeEach(async () => setServerClock(null))
  test.afterEach(async () => setServerClock(null))

  test.describe('未登录访问', () => {
    test('页面提示登录后才能管理', async ({ page, request }) => {
      await page.goto('/api-tokens')
      await expect(page.getByText('登录后才能管理个人 API Token。')).toBeVisible()
      await expect(page.getByRole('main').getByRole('link', { name: '登录', exact: true })).toBeVisible()
      await expect(page.getByRole('main').getByRole('link', { name: '注册', exact: true })).toBeVisible()
      await expect(page.getByRole('button', { name: '创建', exact: true })).toHaveCount(0)

      expect((await request.get('/api/token')).status()).toBe(401)
      expect(
        (await request.post('/api/token', { data: { name: 'anonymous' }, headers: { Origin: appOrigin() } })).status(),
      ).toBe(401)
      expect(
        (await request.delete(`/api/token/${crypto.randomUUID()}`, { headers: { Origin: appOrigin() } })).status(),
      ).toBe(401)
    })
  })

  test.describe('创建与展示', () => {
    test('空白名称不会提交', async ({ page, playwright }) => {
      await signInOnTokenPage(page, playwright)
      await expect(page.getByText('还没有 API Token')).toBeVisible()
      await expectCreateRejected(page, '   ', '请输入名称')
    })

    test('超长名称不会提交', async ({ page, playwright }) => {
      await signInOnTokenPage(page, playwright)
      await expect(page.getByText('还没有 API Token')).toBeVisible()
      await expectCreateRejected(page, 'x'.repeat(51), '名称不能超过 50 个字符')
    })

    test('成功创建 90 天 Token', async ({ page, playwright }) => {
      await signIn(page, playwright)
      await openTokenPageFromNav(page)
      await expect(page.getByText('还没有 API Token')).toBeVisible()
      await expect(page.getByRole('radio', { name: '90 天', exact: true })).toBeChecked()
      const token = await createToken(page, '  自动化脚本  ')
      await expect(tokenItem(page, '自动化脚本')).toContainText('有效期至')
      expect(token.name).toBe('自动化脚本')
      expect(token.token).toMatch(/^dm_[A-Za-z0-9_-]+$/)
      expect(Date.parse(token.expiresAt ?? '') - Date.parse(token.createdAt)).toBe(90 * 86_400_000)
    })

    test('永久 Token 显示永不过期', async ({ page, playwright }) => {
      await signInOnTokenPage(page, playwright)
      await page.getByRole('radio', { name: '永不过期', exact: true }).check()
      const permanent = await createToken(page, '永久脚本')
      expect(permanent.expiresAt).toBeNull()
      await expect(tokenItem(page, permanent.name)).toContainText('永不过期')
    })

    test('复制明文 Token', async ({ page, playwright, context }) => {
      await signInOnTokenPage(page, playwright)
      await createToken(page, '  自动化脚本  ')
      const displayed = await tokenSecretInput(page).inputValue()
      await context.grantPermissions(['clipboard-read', 'clipboard-write'])
      await page.getByRole('button', { name: '复制', exact: true }).click()
      await expect(page.getByRole('button', { name: '已复制', exact: true })).toBeVisible()
      expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(displayed)
    })

    test('刷新后隐藏明文，列表仍在', async ({ page, playwright }) => {
      await signInOnTokenPage(page, playwright)
      const token = await createToken(page, '  自动化脚本  ')
      await page.getByRole('radio', { name: '永不过期', exact: true }).check()
      const permanent = await createToken(page, '永久脚本')
      const list = await page.request.get('/api/token')
      expect(list.status()).toBe(200)
      expect(await list.json()).toEqual(
        expect.arrayContaining([token, permanent].map(({ token: _secret, ...metadata }) => metadata)),
      )
      await page.reload()
      await expect(page.getByRole('listitem')).toHaveCount(2)
      await expect(tokenItem(page, token.name)).toBeVisible()
      await expect(tokenItem(page, permanent.name)).toBeVisible()
      await expect(tokenSecretInput(page)).toHaveCount(0)
      await expect(page.getByRole('main')).not.toContainText(token.token)
      await expect(page.getByRole('main')).not.toContainText(permanent.token)
    })
  })

  test.describe('撤销', () => {
    test('撤销后条目与明文消失，Token 立即失效', async ({ page, playwright }) => {
      await signInOnTokenPage(page, playwright)
      const token = await createToken(page, '业务脚本')
      await withBearer(playwright, token.token, async (api) => {
        await expectStatus(api, 200)
        await tokenItem(page, token.name).getByRole('button', { name: '撤销' }).click()
        await expect(page.getByText('还没有 API Token')).toBeVisible()
        await expect(tokenSecretInput(page)).toHaveCount(0)
        await expect(page.getByRole('main')).not.toContainText(token.token)
        await expectStatus(api, 401)
      })
      await page.reload()
      await expect(page.getByText('还没有 API Token')).toBeVisible()
      await expect(page.getByText(token.name, { exact: true })).toHaveCount(0)
      await expect(tokenSecretInput(page)).toHaveCount(0)
    })
  })

  test.describe('用户隔离', () => {
    test('切换账号清除明文与旧列表', async ({ page, playwright }) => {
      const first = await registerAccount(playwright)
      const second = await registerAccount(playwright)
      await openLogin(page)
      await login(page, first)
      await openTokenPage(page)
      const token = await createToken(page, '第一个账号的脚本')
      await signOut(page)
      await expect(tokenSecretInput(page)).toHaveCount(0)
      await expect(page.getByRole('main')).not.toContainText(token.token)
      await openLogin(page)
      await login(page, second)
      await openTokenPageFromNav(page)
      await expect(page.getByText('还没有 API Token')).toBeVisible()
      await expect(page.getByText(token.name, { exact: true })).toHaveCount(0)
      await expect(tokenSecretInput(page)).toHaveCount(0)
      await expect(page.getByRole('main')).not.toContainText(token.token)
      expect(await (await page.request.get('/api/token')).json()).toEqual([])
    })
  })

  test.describe('有效期', () => {
    test('页面显示过期', async ({ page, playwright }) => {
      await signIn(page, playwright)
      await setServerClock(Date.parse('2030-01-01T00:00:00Z'))
      const created = await page.request.post('/api/token', {
        data: { name: '到期脚本' },
        headers: { Origin: appOrigin() },
      })
      expect(created.status()).toBe(200)
      const token: CreatedApiTokenResponse = await created.json()
      const expires = Date.parse(token.expiresAt ?? '')
      expect(Number.isFinite(expires)).toBe(true)
      await withBearer(playwright, token.token, async (api) => {
        await expectStatus(api, 200)
        await setServerClock(expires)
        await page.clock.setFixedTime(expires)
        await openTokenPage(page)
        await expect(tokenItem(page, token.name)).toContainText(/已于 .+ 过期/)
        await expectStatus(api, 401)
      })
    })
  })
})
