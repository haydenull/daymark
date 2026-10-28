import type { Page, PlaywrightWorkerArgs, Route } from '@playwright/test'
import { expect, test } from '@playwright/test'

import { login, openLogin, registerAccount, signOut } from './helpers/auth'
import { setServerClock } from './helpers/clock'
import {
  addButton,
  chooseBirthday,
  chooseFestival,
  chooseSolarAnniversary,
  dayItem,
  expectApiStatus,
  expectEditor,
  festivalSelect,
  listImportantDays,
  openImportantDays,
  prepareLunarBirthdays,
  submitImportantDay,
} from './helpers/important-day'

const birthdayInput = {
  type: 'lunar_birthday' as const,
  title: '未登录',
  birthYear: null,
  lunarMonth: 1,
  lunarDay: 1,
  isLeapMonth: false,
}

const lunarBirthdaySeeds = [
  { title: '无年份', lunarMonth: 8, lunarDay: 15 },
  { title: '有年份', lunarMonth: 6, lunarDay: 1, isLeapMonth: true, birthYear: 2025 },
] as const

test.describe('重要日子', () => {
  test.describe.configure({ timeout: 90_000 })

  test.beforeEach(async () => {
    await setServerClock(null)
  })

  test('未登录时提示登录，重要日子接口返回 401', async ({ page, request }) => {
    await openImportantDays(page)
    const main = page.getByRole('main')
    await expect(main.getByText('登录后才能添加和查看自己的重要日子。')).toBeVisible()
    await expect(main.getByRole('link', { name: '登录', exact: true })).toBeVisible()
    await expect(main.getByRole('link', { name: '注册', exact: true })).toBeVisible()
    await expect(addButton(page)).toHaveCount(0)

    const calls = [
      request.get('/api/important-day'),
      request.get('/api/important-day/festivals'),
      request.post('/api/important-day', { data: birthdayInput }),
      request.patch('/api/important-day/1', { data: birthdayInput }),
      request.delete('/api/important-day/1'),
    ]
    for (const call of calls) {
      await expectApiStatus(await call, 401, '未登录')
    }
  })

  test('切换账号后不显示旧记录，越权修改和删除返回 404', async ({ page, playwright }) => {
    const owner = await registerAccount(playwright)
    await openLogin(page)
    await login(page, owner)
    await openImportantDays(page)
    await expectEditor(page)
    await chooseBirthday(page, { title: '只属于甲', month: '4', day: '2' })
    await submitImportantDay(page)
    await expect(dayItem(page, '只属于甲')).toBeVisible()
    const [owned] = await listImportantDays(page)
    if (!owned) throw new Error('甲的重要日子没有保存')

    await signOut(page)
    const other = await registerAccount(playwright)
    await openLogin(page)
    await login(page, other)
    await openImportantDays(page)
    await expect(page.getByText('还没有重要日子')).toBeVisible()
    await expect(page.getByText('只属于甲')).toHaveCount(0)

    await expectApiStatus(
      await page.request.patch(`/api/important-day/${owned.id}`, {
        data: { ...birthdayInput, title: '篡改' },
      }),
      404,
      '重要日子不存在',
    )
    await expectApiStatus(await page.request.delete(`/api/important-day/${owned.id}`), 404, '重要日子不存在')
    await expect(page.getByText('只属于甲')).toHaveCount(0)

    await signOut(page)
    await openLogin(page)
    await login(page, owner)
    await openImportantDays(page)
    await expect(dayItem(page, '只属于甲')).toContainText('农历每年四月初二')
    const [stillOwned] = await listImportantDays(page)
    expect(stillOwned).toMatchObject({
      id: owned.id,
      title: '只属于甲',
      type: 'lunar_birthday',
      birthYear: null,
      lunarMonth: 4,
      lunarDay: 2,
      isLeapMonth: false,
      festivalCode: null,
    })
  })

  test.describe('农历生日', () => {
    test('新增并持久化', async ({ page, playwright }) => {
      await signIn(page, playwright)
      await expect(page.getByText('还没有重要日子')).toBeVisible()

      await chooseBirthday(page, { title: '无年份', month: '8', day: '15' })
      await submitImportantDay(page)
      await expect(dayItem(page, '无年份')).toContainText('农历每年八月十五')
      await expect(dayItem(page, '无年份')).toContainText(/下次公历 \d{4}-\d{2}-\d{2}，(今天|剩余 \d+ 天)/)

      await chooseBirthday(page, { title: '有年份', month: '6', day: '1', leap: true, birthYear: '2025' })
      await submitImportantDay(page)
      await expect(dayItem(page, '有年份')).toContainText('农历每年闰六月初一（农历出生年2025）')

      await page.reload()
      await expect(dayItem(page, '无年份')).toBeVisible()
      await expect(dayItem(page, '有年份')).toBeVisible()
    })

    test('编辑支持回填、取消和保存', async ({ page, playwright }) => {
      await signIn(page, playwright)
      await prepareLunarBirthdays(page, lunarBirthdaySeeds)

      await dayItem(page, '无年份').getByRole('button', { name: '编辑', exact: true }).click()
      await expect(dayItem(page, '无年份')).toContainText('正在编辑')
      await expect(page.getByLabel('类型')).toHaveValue('lunar_birthday')
      await expect(page.getByLabel('类型')).toBeDisabled()
      await expect(page.getByLabel('名称')).toHaveValue('无年份')
      await expect(page.getByLabel('农历月')).toHaveValue('8')
      await expect(page.getByLabel('农历日')).toHaveValue('15')
      await expect(page.getByLabel('闰月')).not.toBeChecked()
      await expect(page.getByLabel('农历出生年份（选填）')).toHaveValue('')
      await expect(page.getByRole('button', { name: '保存', exact: true })).toBeVisible()
      await page.getByLabel('名称').fill('不应保存')
      await page.getByRole('button', { name: '取消', exact: true }).click()
      await expect(page.getByText('正在编辑')).toHaveCount(0)
      await expect(page.getByLabel('名称')).toHaveValue('')
      await expect(addButton(page)).toBeVisible()
      await expect(page.getByText('不应保存')).toHaveCount(0)
      await expect(dayItem(page, '无年份')).toContainText('农历每年八月十五')
      await expect(dayItem(page, '有年份')).toBeVisible()
      expect(await findDay(page, '无年份')).toMatchObject({
        title: '无年份',
        type: 'lunar_birthday',
        birthYear: null,
        lunarMonth: 8,
        lunarDay: 15,
        isLeapMonth: false,
        festivalCode: null,
      })

      await dayItem(page, '有年份').getByRole('button', { name: '编辑', exact: true }).click()
      await expect(page.getByLabel('农历月')).toHaveValue('6')
      await expect(page.getByLabel('农历日')).toHaveValue('1')
      await expect(page.getByLabel('闰月')).toBeChecked()
      await expect(page.getByLabel('农历出生年份（选填）')).toHaveValue('2025')
      await page.getByLabel('名称').fill('妈妈')
      await page.getByRole('button', { name: '保存', exact: true }).click()
      await expect(dayItem(page, '妈妈')).toContainText('农历每年闰六月初一（农历出生年2025）')
      await page.reload()
      await expect(dayItem(page, '妈妈')).toBeVisible()
    })

    test('编辑可修改名称、月日并清空出生年', async ({ page, playwright }) => {
      await signIn(page, playwright)
      const [birthday] = await prepareLunarBirthdays(page, [
        { title: '小满', lunarMonth: 4, lunarDay: 1, birthYear: 1990 },
      ])
      if (!birthday) throw new Error('小满没有保存')

      await dayItem(page, '小满').getByRole('button', { name: '编辑', exact: true }).click()
      await page.getByLabel('名称').fill('妈妈')
      await page.getByLabel('农历月').selectOption('2')
      await page.getByLabel('农历日').selectOption('2')
      await page.getByLabel('农历出生年份（选填）').fill('')
      await page.getByRole('button', { name: '保存', exact: true }).click()
      await expect(dayItem(page, '妈妈')).toContainText('农历每年二月初二')
      expect(await findDay(page, '妈妈')).toMatchObject({
        id: birthday.id,
        type: 'lunar_birthday',
        title: '妈妈',
        birthYear: null,
        lunarMonth: 2,
        lunarDay: 2,
        isLeapMonth: false,
        festivalCode: null,
      })
    })

    test('删除并持久化', async ({ page, playwright }) => {
      await signIn(page, playwright)
      await prepareLunarBirthdays(page, lunarBirthdaySeeds)

      await dayItem(page, '无年份').getByRole('button', { name: '删除', exact: true }).click()
      await expect(dayItem(page, '无年份')).toHaveCount(0)
      await expect(dayItem(page, '有年份')).toBeVisible()
      expect(await findDay(page, '有年份')).toMatchObject({
        title: '有年份',
        type: 'lunar_birthday',
        birthYear: 2025,
        lunarMonth: 6,
        lunarDay: 1,
        isLeapMonth: true,
        festivalCode: null,
      })

      await dayItem(page, '有年份').getByRole('button', { name: '删除', exact: true }).click()
      await expect(page.getByText('还没有重要日子')).toBeVisible()
      await page.reload()
      await expect(page.getByText('还没有重要日子')).toBeVisible()
      expect(await listImportantDays(page)).toEqual([])
    })
  })

  test.describe('公历纪念日', () => {
    test('新增、编辑并持久化', async ({ page, playwright }) => {
      await signIn(page, playwright)
      await chooseSolarAnniversary(page, { title: '领证纪念日', month: '5', day: '27', year: '2021' })
      await submitImportantDay(page)
      await expect(dayItem(page, '领证纪念日')).toContainText('公历每年5月27日（起始年2021）')
      await expect(dayItem(page, '领证纪念日')).toContainText(/下次公历 \d{4}-\d{2}-\d{2}，(今天|剩余 \d+ 天)/)
      const created = await findDay(page, '领证纪念日')
      expect(created).toMatchObject({
        title: '领证纪念日',
        type: 'solar_anniversary',
        birthYear: null,
        lunarMonth: null,
        lunarDay: null,
        isLeapMonth: null,
        festivalCode: null,
        solarMonth: 5,
        solarDay: 27,
        anniversaryYear: 2021,
      })

      await dayItem(page, '领证纪念日').getByRole('button', { name: '编辑', exact: true }).click()
      await expect(page.getByLabel('类型')).toHaveValue('solar_anniversary')
      await expect(page.getByLabel('类型')).toBeDisabled()
      await expect(page.getByLabel('名称')).toHaveValue('领证纪念日')
      await expect(page.getByLabel('公历月')).toHaveValue('5')
      await expect(page.getByLabel('公历日')).toHaveValue('27')
      await expect(page.getByLabel('起始年（选填）')).toHaveValue('2021')
      await page.getByLabel('公历日').selectOption('31')
      await page.getByLabel('公历月').selectOption('2')
      await expect(page.getByLabel('公历日')).toHaveValue('29')
      await expect(page.getByLabel('公历日').locator('option')).toHaveCount(29)
      await page.getByLabel('名称').fill('结婚纪念日')
      await page.getByLabel('公历月').selectOption('6')
      await page.getByLabel('公历日').selectOption('1')
      await page.getByLabel('起始年（选填）').fill('')
      await page.getByRole('button', { name: '保存', exact: true }).click()
      await expect(dayItem(page, '结婚纪念日')).toContainText('公历每年6月1日')
      expect(await findDay(page, '结婚纪念日')).toMatchObject({
        id: created.id,
        type: 'solar_anniversary',
        title: '结婚纪念日',
        solarMonth: 6,
        solarDay: 1,
        anniversaryYear: null,
        festivalCode: null,
      })
      await page.reload()
      await expect(dayItem(page, '结婚纪念日')).toBeVisible()
    })

    test('非闰起始年的2月29日和不可能的月日会被拒绝', async ({ page, playwright }) => {
      await signIn(page, playwright)
      await chooseSolarAnniversary(page, { title: '闰日', month: '2', day: '29', year: '2021' })
      await submitImportantDay(page)
      await expect(page.getByText('公历2021年没有2月29日', { exact: true })).toBeVisible()
      await expect(dayItem(page, '闰日')).toHaveCount(0)

      await expectApiStatus(
        await page.request.post('/api/important-day', {
          data: {
            type: 'solar_anniversary',
            title: '不存在',
            anniversaryYear: null,
            solarMonth: 4,
            solarDay: 31,
          },
        }),
        400,
        '公历没有4月31日',
      )
      expect(await listImportantDays(page)).toEqual([])
    })
  })

  test.describe('节日', () => {
    test('新增并持久化', async ({ page, playwright }) => {
      await signIn(page, playwright)

      await page.getByLabel('类型').selectOption('festival')
      const festival = festivalSelect(page)
      await expect(festival).toBeEnabled()
      await expect(page.getByLabel('名称')).toHaveCount(0)
      const names = ['情人节', '妇女节', '春节', '七夕', '中秋', '母亲节', '父亲节', '闰月鞋']
      for (const name of names) {
        await expect(festival.locator('option', { hasText: name })).toHaveCount(1)
      }

      await festival.selectOption('valentines_day')
      await expect(page.getByText('公历每年2月14日', { exact: true })).toBeVisible()
      await festival.selectOption('womens_day')
      await expect(page.getByText('公历每年3月8日', { exact: true })).toBeVisible()
      await festival.selectOption('leap_month_shoes')
      await expect(page.getByText('农历闰月初十，无闰月年份跳过', { exact: true })).toBeVisible()
      await festival.selectOption('spring_festival')
      await expect(page.getByText('农历每年正月初一', { exact: true })).toBeVisible()
      await submitImportantDay(page)
      await expect(dayItem(page, '春节')).toContainText('农历每年正月初一')
      await expect(dayItem(page, '春节').getByRole('button', { name: '编辑', exact: true })).toHaveCount(0)
      await expect(dayItem(page, '春节').getByRole('button', { name: '删除', exact: true })).toBeVisible()
      expect(await findDay(page, '春节')).toMatchObject({
        title: '春节',
        type: 'festival',
        birthYear: null,
        lunarMonth: null,
        lunarDay: null,
        isLeapMonth: null,
        festivalCode: 'spring_festival',
      })

      await chooseFestival(page, 'leap_month_shoes')
      await submitImportantDay(page)
      await expect(dayItem(page, '闰月鞋')).toContainText('农历闰月初十，无闰月年份跳过')
      await expect(dayItem(page, '闰月鞋').getByRole('button', { name: '编辑', exact: true })).toHaveCount(0)
      expect(await findDay(page, '闰月鞋')).toMatchObject({
        title: '闰月鞋',
        type: 'festival',
        birthYear: null,
        lunarMonth: null,
        lunarDay: null,
        isLeapMonth: null,
        festivalCode: 'leap_month_shoes',
      })

      await page.reload()
      await expect(dayItem(page, '春节')).toBeVisible()
      await expect(dayItem(page, '闰月鞋')).toBeVisible()
    })

    test('重复新增会被拒绝', async ({ page, playwright }) => {
      await signIn(page, playwright)
      await chooseFestival(page, 'spring_festival')
      await submitImportantDay(page)
      await expect(dayItem(page, '春节')).toBeVisible()

      await chooseFestival(page, 'spring_festival')
      await submitImportantDay(page)
      await expect(page.getByText('该节日已存在', { exact: true })).toBeVisible()
      expect(await listImportantDays(page)).toHaveLength(1)
    })

    test('删除并持久化', async ({ page, playwright }) => {
      await signIn(page, playwright)
      await chooseFestival(page, 'spring_festival')
      await submitImportantDay(page)
      await expect(dayItem(page, '春节')).toBeVisible()

      await dayItem(page, '春节').getByRole('button', { name: '删除', exact: true }).click()
      await expect(dayItem(page, '春节')).toHaveCount(0)
      await expect(page.getByText('还没有重要日子')).toBeVisible()
      await page.reload()
      await expect(page.getByText('还没有重要日子')).toBeVisible()
      expect(await listImportantDays(page)).toEqual([])
    })
  })

  test('非法输入在本地拦截，不存在的农历出生日期由服务端拒绝', async ({ page, playwright }) => {
    await signIn(page, playwright)
    let posts = 0
    const handler = async (route: Route) => {
      if (route.request().method() === 'POST') posts += 1
      await route.continue()
    }
    await page.route(isImportantDayCollection, handler)
    try {
      const cases = [
        { title: '   ', year: '', message: '请填写名称' },
        { title: '日'.repeat(51), year: '', message: '名称不能超过 50 个字' },
        { title: '年份', year: '0', message: '农历出生年份须为 1 到 9999 的整数，或留空' },
        { title: '年份', year: '10000', message: '农历出生年份须为 1 到 9999 的整数，或留空' },
      ]
      for (const item of cases) {
        await chooseBirthday(page, { title: item.title, month: '1', day: '1', birthYear: item.year })
        await addButton(page).click()
        await expect(page.getByText(item.message, { exact: true })).toBeVisible()
        expect(posts).toBe(0)
      }

      await page.getByLabel('类型').selectOption('festival')
      await expect(festivalSelect(page)).toBeEnabled()
      await expect(page.getByLabel('名称')).toHaveCount(0)
      await addButton(page).click()
      await expect(page.getByRole('paragraph').filter({ hasText: /^请选择节日$/ })).toBeVisible()
      expect(posts).toBe(0)
    } finally {
      await page.unroute(isImportantDayCollection, handler)
    }

    await chooseBirthday(page, { title: '不存在', month: '12', day: '30', birthYear: '2025' })
    await submitImportantDay(page)
    await expect(page.getByText('农历2025年腊月没有三十', { exact: true })).toBeVisible()
    await expect(dayItem(page, '不存在')).toHaveCount(0)

    await page.getByLabel('农历日').selectOption('29')
    await submitImportantDay(page)
    await expect(page.getByText('农历2025年腊月没有三十')).toHaveCount(0)
    await expect(dayItem(page, '不存在')).toContainText('农历每年腊月廿九（农历出生年2025）')
    await page.reload()
    await expect(dayItem(page, '不存在')).toBeVisible()
  })

  test('保存未完成时不能重复提交，失败后可以重试', async ({ page, playwright }) => {
    await signIn(page, playwright)
    await chooseBirthday(page, { title: '重试生日', month: '1', day: '1' })

    let posts = 0
    let markIntercepted = (): void => {}
    const intercepted = new Promise<void>((resolve) => {
      markIntercepted = resolve
    })
    let release = (): void => {}
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const handler = async (route: Route) => {
      if (route.request().method() !== 'POST') {
        await route.continue()
        return
      }
      posts += 1
      markIntercepted()
      await gate
      await route.abort('failed')
    }

    await page.route(isImportantDayCollection, handler)
    try {
      await addButton(page).click()
      await intercepted
      const pending = page.getByRole('main').getByRole('button', { name: '保存中...', exact: true })
      await expect(pending).toBeDisabled()
      const box = await pending.boundingBox()
      if (!box) throw new Error('保存中按钮没有可点击区域')
      await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
      await page.evaluate(
        () =>
          new Promise<void>((resolveFrame) => {
            requestAnimationFrame(() => resolveFrame())
          }),
      )
      expect(posts).toBe(1)
      release()
      await expect(page.getByText(/Request failed due to a network error: POST /)).toBeVisible()
      await expect(addButton(page)).toBeEnabled()
      await expect(dayItem(page, '重试生日')).toHaveCount(0)
    } finally {
      release()
      await page.unroute(isImportantDayCollection, handler)
    }

    await addButton(page).click()
    await expect(dayItem(page, '重试生日')).toContainText('农历每年正月初一')
  })
})

function isImportantDayCollection(url: URL): boolean {
  return url.pathname === '/api/important-day'
}

async function signIn(page: Page, playwright: PlaywrightWorkerArgs['playwright']): Promise<void> {
  const account = await registerAccount(playwright)
  await openLogin(page)
  await login(page, account)
  await openImportantDays(page)
  await expectEditor(page)
}

async function findDay(page: Page, title: string) {
  const days = await listImportantDays(page)
  const found = days.find((item) => item.title === title)
  if (!found) throw new Error(`列表里没有${title}`)
  return found
}
