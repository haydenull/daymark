import type { APIResponse, Locator, Page } from '@playwright/test'
import { expect } from '@playwright/test'

export type ImportantDayRecord = {
  id: number
  title: string
  type: 'lunar_birthday' | 'festival' | 'solar_anniversary'
  birthYear: number | null
  lunarMonth: number | null
  lunarDay: number | null
  isLeapMonth: boolean | null
  festivalCode: string | null
  solarMonth: number | null
  solarDay: number | null
  anniversaryYear: number | null
  ruleLabel: string
  nextDate: string
  daysRemaining: number
}

type BirthdayFields = {
  title: string
  month: string
  day: string
  leap?: boolean
  birthYear?: string
}

export async function openImportantDays(page: Page): Promise<void> {
  await page.goto('/important-days')
  await expect(page.getByRole('heading', { name: '重要日子' })).toBeVisible()
}

export async function expectEditor(page: Page): Promise<void> {
  await expect(page.getByRole('main').getByRole('button', { name: '添加', exact: true })).toBeVisible()
}

export function dayItem(page: Page, title: string): Locator {
  return page.getByRole('listitem').filter({ has: page.getByText(title, { exact: true }) })
}

type SolarAnniversaryFields = {
  title: string
  month: string
  day: string
  year?: string
}

export async function chooseSolarAnniversary(page: Page, fields: SolarAnniversaryFields): Promise<void> {
  await page.getByLabel('类型').selectOption('solar_anniversary')
  await page.getByLabel('名称').fill(fields.title)
  await page.getByLabel('公历月').selectOption(fields.month)
  await page.getByLabel('公历日').selectOption(fields.day)
  await page.getByLabel('起始年（选填）').fill(fields.year ?? '')
}

export async function chooseBirthday(page: Page, fields: BirthdayFields): Promise<void> {
  await page.getByLabel('类型').selectOption('lunar_birthday')
  await page.getByLabel('名称').fill(fields.title)
  await page.getByLabel('农历月').selectOption(fields.month)
  await page.getByLabel('农历日').selectOption(fields.day)
  const leap = page.getByLabel('闰月')
  if (fields.leap) await leap.check()
  else await leap.uncheck()
  await page.getByLabel('农历出生年份（选填）').fill(fields.birthYear ?? '')
}

// 类型下拉的选项里也有“节日”，不能用含糊的 getByLabel('节日')。
export function festivalSelect(page: Page): Locator {
  return page.getByRole('combobox', { name: /^节日/ })
}

export async function chooseFestival(page: Page, code: string): Promise<void> {
  await page.getByLabel('类型').selectOption('festival')
  const festival = festivalSelect(page)
  await expect(festival).toBeEnabled()
  await festival.selectOption(code)
}

export function addButton(page: Page): Locator {
  return page.getByRole('main').getByRole('button', { name: '添加', exact: true })
}

export async function submitImportantDay(page: Page): Promise<void> {
  await page
    .getByRole('main')
    .getByRole('button', { name: /^(添加|保存)$/ })
    .click()
}

export async function expectOccurrence(
  page: Page,
  title: string,
  ruleLabel: string,
  nextDate: string,
  daysRemaining: number,
): Promise<void> {
  const item = dayItem(page, title)
  const when = daysRemaining === 0 ? '今天' : `剩余 ${daysRemaining} 天`
  await expect(item.getByText(title, { exact: true })).toBeVisible()
  await expect(item).toContainText(ruleLabel)
  await expect(item).toContainText(`下次公历 ${nextDate}，${when}`)
}

export async function listImportantDays(page: Page): Promise<ImportantDayRecord[]> {
  const response = await page.request.get('/api/important-day')
  const text = await response.text()
  if (!response.ok()) throw new Error(`读取重要日子失败：${response.status()} ${text}`)
  return JSON.parse(text) as ImportantDayRecord[]
}

type LunarBirthdaySeed = {
  title: string
  lunarMonth: number
  lunarDay: number
  isLeapMonth?: boolean
  birthYear?: number | null
}

export async function prepareLunarBirthdays(
  page: Page,
  items: readonly LunarBirthdaySeed[],
): Promise<ImportantDayRecord[]> {
  const records: ImportantDayRecord[] = []
  for (const item of items) {
    const response = await page.request.post('/api/important-day', {
      data: {
        type: 'lunar_birthday',
        title: item.title,
        birthYear: item.birthYear ?? null,
        lunarMonth: item.lunarMonth,
        lunarDay: item.lunarDay,
        isLeapMonth: item.isLeapMonth ?? false,
      },
    })
    const text = await response.text()
    if (!response.ok()) throw new Error(`准备农历生日失败：${response.status()} ${text}`)
    records.push(JSON.parse(text) as ImportantDayRecord)
  }
  await page.reload()
  await expect(page.getByRole('heading', { name: '重要日子' })).toBeVisible()
  for (const item of items) {
    await expect(dayItem(page, item.title)).toBeVisible()
  }
  return records
}

export async function expectApiStatus(response: APIResponse, status: number, message: string): Promise<void> {
  const text = await response.text()
  expect(response.status(), text).toBe(status)
  expect(JSON.parse(text) as unknown).toEqual({ code: status, message })
}
