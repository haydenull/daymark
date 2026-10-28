import type { Page, PlaywrightWorkerArgs, Response } from '@playwright/test'
import { expect, test } from '@playwright/test'

import { login, openLogin, registerAccount } from './helpers/auth'
import { beijingEpoch, daysBetween, installBrowserClock, setServerClock } from './helpers/clock'
import { festivalSamples, leapMonthShoesSamples, lunarSamples, sortSamples } from './helpers/date-samples'
import {
  chooseBirthday,
  chooseFestival,
  chooseSolarAnniversary,
  dayItem,
  expectEditor,
  expectOccurrence,
  openImportantDays,
} from './helpers/important-day'

test.describe('重要日子日期', () => {
  test.describe.configure({ timeout: 90_000 })

  test.beforeEach(async () => {
    await setServerClock(null)
  })

  test.afterEach(async () => {
    await setServerClock(null)
  })

  test('普通农历、无闰月回退和七个节日按真实计算结果排序', async ({ page, playwright }) => {
    const today = '2026-03-01'
    await signInAt(page, playwright, today)

    const created: { title: string; ruleLabel: string; nextDate: string }[] = []
    const plan = [
      { ...lunarSamples.noLeapFallback, leap: true },
      { ...lunarSamples.ordinary, leap: false },
      ...festivalSamples.items,
    ]
    for (const row of plan) {
      if ('code' in row) await chooseFestival(page, row.code)
      else await chooseBirthday(page, { title: row.title, month: row.month, day: row.day, leap: row.leap })
      await addAndSee(page, row.title)
      created.push(row)
      await expectOccurrence(page, row.title, row.ruleLabel, row.nextDate, daysBetween(today, row.nextDate))
    }

    const expected = [...created].sort(
      (left, right) =>
        daysBetween(today, left.nextDate) - daysBetween(today, right.nextDate) ||
        created.indexOf(left) - created.indexOf(right),
    )
    await expectDatedOrder(page, today, expected)
    await page.reload()
    await expectDatedOrder(page, today, expected)
  })

  test('有闰月时用闰月，三十在小月回退到廿九', async ({ page, playwright }) => {
    const today = lunarSamples.leapMonth.today
    await signInAt(page, playwright, today)
    await addBirthday(page, lunarSamples.leapMonth, true)
    await addBirthday(page, lunarSamples.leapShortMonth, true)

    const leapDay = lunarSamples.leapMonth
    await expectOccurrence(
      page,
      leapDay.title,
      leapDay.ruleLabel,
      leapDay.nextDate,
      daysBetween(today, leapDay.nextDate),
    )
    await expect(dayItem(page, leapDay.title)).not.toContainText(leapDay.regularMonthDate)

    const shortMonth = lunarSamples.leapShortMonth
    await expectOccurrence(
      page,
      shortMonth.title,
      shortMonth.ruleLabel,
      shortMonth.nextDate,
      daysBetween(today, shortMonth.nextDate),
    )
    await expect(dayItem(page, shortMonth.title)).not.toContainText(shortMonth.regularThirtyDate)
  })

  test('公历年初仍属上一农历年，腊月三十回退到廿九', async ({ page, playwright }) => {
    const today = lunarSamples.previousLunarYear.today
    await signInAt(page, playwright, today)
    await addBirthday(page, lunarSamples.previousLunarYear, false)
    await addBirthday(page, lunarSamples.shortTwelfthMonth, false)

    const twelfth = lunarSamples.previousLunarYear
    await expectOccurrence(
      page,
      twelfth.title,
      twelfth.ruleLabel,
      twelfth.nextDate,
      daysBetween(today, twelfth.nextDate),
    )
    await expect(dayItem(page, twelfth.title)).not.toContainText(twelfth.followingLunarYearDate)

    const shortMonth = lunarSamples.shortTwelfthMonth
    await expectOccurrence(
      page,
      shortMonth.title,
      shortMonth.ruleLabel,
      shortMonth.nextDate,
      daysBetween(today, shortMonth.nextDate),
    )
  })

  test('当天显示今天，次日进入下一年，相同剩余天数按 id 排序', async ({ page, playwright }) => {
    await signInAt(page, playwright, sortSamples.today)
    await chooseFestival(page, 'womens_day')
    await addAndSee(page, '妇女节')
    await chooseFestival(page, 'spring_festival')
    await addAndSee(page, '春节')
    await chooseBirthday(page, { title: '正月初一', month: '1', day: '1' })
    await addAndSee(page, '正月初一')
    await chooseFestival(page, 'valentines_day')
    await addAndSee(page, '情人节')

    await expectOrder(page, sortSamples.todayOrder)

    await setServerClock(beijingEpoch(sortSamples.nextDay))
    // setSystemTime 只改浏览器时间，不暂停定时器。pauseAt 会让重新加载停在“加载中”。
    await page.clock.setSystemTime(beijingEpoch(sortSamples.nextDay))
    await page.reload()
    await expectOrder(page, sortSamples.nextDayOrder)
  })

  test('闰月鞋有闰月时用闰月初十，不用普通同月', async ({ page, playwright }) => {
    const sample = leapMonthShoesSamples.withLeapMonth
    await signInAt(page, playwright, sample.today)
    await chooseFestival(page, 'leap_month_shoes')
    await addAndSee(page, leapMonthShoesSamples.title)
    await expectOccurrence(
      page,
      leapMonthShoesSamples.title,
      leapMonthShoesSamples.ruleLabel,
      sample.nextDate,
      daysBetween(sample.today, sample.nextDate),
    )
    await expect(dayItem(page, leapMonthShoesSamples.title)).not.toContainText(sample.regularMonthTenth)
  })

  test('闰月鞋无闰月年份跳过，不回退到普通月', async ({ page, playwright }) => {
    const sample = leapMonthShoesSamples.noLeapYear
    await signInAt(page, playwright, sample.today)
    await chooseFestival(page, 'leap_month_shoes')
    await addAndSee(page, leapMonthShoesSamples.title)
    await expectOccurrence(
      page,
      leapMonthShoesSamples.title,
      leapMonthShoesSamples.ruleLabel,
      sample.nextDate,
      daysBetween(sample.today, sample.nextDate),
    )
    await expect(dayItem(page, leapMonthShoesSamples.title)).not.toContainText(sample.skippedRegularTenth)
  })

  test('闰月鞋初十当天算这次，次日跨三年到下一闰月', async ({ page, playwright }) => {
    const onTheDay = leapMonthShoesSamples.onTheDay
    await signInAt(page, playwright, onTheDay.today)
    await chooseFestival(page, 'leap_month_shoes')
    await addAndSee(page, leapMonthShoesSamples.title)
    await expectOccurrence(
      page,
      leapMonthShoesSamples.title,
      leapMonthShoesSamples.ruleLabel,
      onTheDay.nextDate,
      daysBetween(onTheDay.today, onTheDay.nextDate),
    )

    const after = leapMonthShoesSamples.afterLeapMonth
    await setServerClock(beijingEpoch(after.today))
    await page.clock.setSystemTime(beijingEpoch(after.today))
    await page.reload()
    await expectOccurrence(
      page,
      leapMonthShoesSamples.title,
      leapMonthShoesSamples.ruleLabel,
      after.nextDate,
      daysBetween(after.today, after.nextDate),
    )
  })

  test('公历纪念日跨年，当天算这次', async ({ page, playwright }) => {
    await signInAt(page, playwright, '2026-05-27')
    await chooseSolarAnniversary(page, { title: '领证纪念日', month: '5', day: '27', year: '2021' })
    await addAndSee(page, '领证纪念日')
    await expectOccurrence(page, '领证纪念日', '公历每年5月27日（起始年2021）', '2026-05-27', 0)

    await setServerClock(beijingEpoch('2026-05-28'))
    await page.clock.setSystemTime(beijingEpoch('2026-05-28'))
    await page.reload()
    await expectOccurrence(
      page,
      '领证纪念日',
      '公历每年5月27日（起始年2021）',
      '2027-05-27',
      daysBetween('2026-05-28', '2027-05-27'),
    )
  })

  test('公历2月29日在闰年用29日，非闰年回退到2月28日', async ({ page, playwright }) => {
    const ruleLabel = '公历每年2月29日，非闰年用2月28日（起始年2020）'
    await signInAt(page, playwright, '2024-02-29')
    await chooseSolarAnniversary(page, { title: '闰日', month: '2', day: '29', year: '2020' })
    await addAndSee(page, '闰日')
    await expectOccurrence(page, '闰日', ruleLabel, '2024-02-29', 0)

    await setServerClock(beijingEpoch('2024-03-01'))
    await page.clock.setSystemTime(beijingEpoch('2024-03-01'))
    await page.reload()
    await expectOccurrence(page, '闰日', ruleLabel, '2025-02-28', daysBetween('2024-03-01', '2025-02-28'))

    await setServerClock(beijingEpoch('2027-03-01'))
    await page.clock.setSystemTime(beijingEpoch('2027-03-01'))
    await page.reload()
    await expectOccurrence(page, '闰日', ruleLabel, '2028-02-29', daysBetween('2027-03-01', '2028-02-29'))
  })

  test('北京时间越过午夜后页面自动刷新', async ({ page, playwright }) => {
    await signInAt(page, playwright, '2026-02-14', '23:00:00')
    await chooseFestival(page, 'valentines_day')
    await addAndSee(page, '情人节')
    await expectOccurrence(page, '情人节', '公历每年2月14日', '2026-02-14', 0)
    await page.waitForLoadState('networkidle')

    await setServerClock(beijingEpoch('2026-02-15', '00:00:05'))
    const refreshed = page.waitForResponse(isImportantDayList, { timeout: 15_000 })
    // 页面用 setTimeout 等到北京时间次日 00:00:01 再刷新。从 23:00 快进越过这个时刻。
    await page.clock.fastForward('01:01:00')
    const response = await refreshed
    const body = (await response.json()) as Array<{ nextDate: string; daysRemaining: number }>
    expect(body).toEqual([expect.objectContaining({ nextDate: '2027-02-14', daysRemaining: 364 })])
    await expectOccurrence(page, '情人节', '公历每年2月14日', '2027-02-14', 364)
    await page.reload()
    await expectOccurrence(page, '情人节', '公历每年2月14日', '2027-02-14', 364)
  })
})

test.describe('浏览器时区不影响重要日子', () => {
  test.describe.configure({ timeout: 90_000 })
  test.use({ timezoneId: 'Pacific/Honolulu' })

  test.beforeEach(async () => {
    await setServerClock(null)
  })

  test.afterEach(async () => {
    await setServerClock(null)
  })

  test('浏览器仍是前一个公历日时，页面显示北京时间的下一次日期', async ({ page, playwright }) => {
    await signInAt(page, playwright, '2026-02-15', '00:30:00')
    const localDate = await page.evaluate(() => ({
      year: new Date().getFullYear(),
      month: new Date().getMonth() + 1,
      day: new Date().getDate(),
    }))
    expect(localDate).toEqual({ year: 2026, month: 2, day: 14 })

    await chooseFestival(page, 'valentines_day')
    await addAndSee(page, '情人节')
    await expectOccurrence(page, '情人节', '公历每年2月14日', '2027-02-14', 364)
    await expect(dayItem(page, '情人节')).not.toContainText('今天')
  })
})

async function signInAt(
  page: Page,
  playwright: PlaywrightWorkerArgs['playwright'],
  isoDate: string,
  time = '12:00:00',
): Promise<void> {
  const account = await registerAccount(playwright)
  const epoch = beijingEpoch(isoDate, time)
  await setServerClock(epoch)
  await installBrowserClock(page, epoch)
  await openLogin(page)
  await login(page, account)
  await openImportantDays(page)
  await expectEditor(page)
}

async function addBirthday(
  page: Page,
  sample: { title: string; month: string; day: string },
  leap: boolean,
): Promise<void> {
  await chooseBirthday(page, { title: sample.title, month: sample.month, day: sample.day, leap })
  await addAndSee(page, sample.title)
}

async function addAndSee(page: Page, title: string): Promise<void> {
  await page.getByRole('button', { name: '添加', exact: true }).click()
  // 上一条成功后会清空表单。必须等它出现，再填下一条，否则会被重置冲掉。
  await expect(dayItem(page, title)).toBeVisible()
  await expect(page.getByRole('button', { name: '添加', exact: true })).toBeEnabled()
}

async function expectDatedOrder(
  page: Page,
  today: string,
  rows: readonly { title: string; nextDate: string }[],
): Promise<void> {
  const items = page.getByRole('listitem')
  await expect(items).toHaveCount(rows.length)
  for (const [index, row] of rows.entries()) {
    const item = items.nth(index)
    await expect(item.getByText(row.title, { exact: true })).toBeVisible()
    const daysRemaining = daysBetween(today, row.nextDate)
    const when = daysRemaining === 0 ? '今天' : `剩余 ${daysRemaining} 天`
    await expect(item).toContainText(`下次公历 ${row.nextDate}，${when}`)
  }
}

async function expectOrder(
  page: Page,
  rows: readonly { title: string; ruleLabel: string; nextDate: string; daysRemaining: number }[],
): Promise<void> {
  const items = page.getByRole('listitem')
  await expect(items).toHaveCount(rows.length)
  for (const [index, row] of rows.entries()) {
    const item = items.nth(index)
    await expect(item.getByText(row.title, { exact: true })).toBeVisible()
    await expect(item).toContainText(row.ruleLabel)
    const when = row.daysRemaining === 0 ? '今天' : `剩余 ${row.daysRemaining} 天`
    await expect(item).toContainText(`下次公历 ${row.nextDate}，${when}`)
  }
}

function isImportantDayList(response: Response): boolean {
  return new URL(response.url()).pathname === '/api/important-day' && response.request().method() === 'GET'
}
