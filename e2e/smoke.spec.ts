import { expect, test } from '@playwright/test'

test('首页可访问且健康检查返回 ok', async ({ page, request }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Bun Fullstack Template' })).toBeVisible()
  await expect(page.getByRole('link', { name: '打开重要日子' })).toBeVisible()

  const health = await request.get('/api/health')
  expect(health.ok()).toBe(true)
  expect(await health.json()).toEqual({ ok: true })
})
