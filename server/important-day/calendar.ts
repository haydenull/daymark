import { LunarDay, LunarMonth, LunarYear, SolarDay } from 'tyme4ts'

import type { FestivalCode } from '@/shared/important-day/festivals'
import { festivalDefinitions, isFestivalCode } from '@/shared/important-day/festivals'

// 日期全部按北京时间的公历日计算，不保存会过期的下一次日期。
// 今天仍算下一次；过了今天才进入下一轮。
// 农历从“今天”所在的农历年开始找，避免公历年初仍属于上一农历年时算错。
// 闰月生日只在该年确有对应闰月时用闰月，否则用普通同月，一年只出现一次。
// 普通月生日不会落到闰月。三十在小月回退到廿九，但填写了出生年时，该年的原始日期必须真实存在，不能回退。
// 闰月鞋只落在该年闰月的初十；没有闰月的年份跳过，不回退到普通月。
// 公历纪念日按公历月日每年重复。2 月 29 日在非闰年回退到 2 月 28 日，保证每年都有一次。
// 填写了起始年时，该公历年必须真实存在这一天，且不能晚于当前北京时间公历年。

const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000

const lunarMonthLabels = [
  '正月',
  '二月',
  '三月',
  '四月',
  '五月',
  '六月',
  '七月',
  '八月',
  '九月',
  '十月',
  '冬月',
  '腊月',
]
const lunarDayLabels = [
  '初一',
  '初二',
  '初三',
  '初四',
  '初五',
  '初六',
  '初七',
  '初八',
  '初九',
  '初十',
  '十一',
  '十二',
  '十三',
  '十四',
  '十五',
  '十六',
  '十七',
  '十八',
  '十九',
  '二十',
  '廿一',
  '廿二',
  '廿三',
  '廿四',
  '廿五',
  '廿六',
  '廿七',
  '廿八',
  '廿九',
  '三十',
]

export class ImportantDayRuleError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ImportantDayRuleError'
  }
}

export type LunarBirthdayRule = {
  type: 'lunar_birthday'
  birthYear: number | null
  lunarMonth: number
  lunarDay: number
  isLeapMonth: boolean
}

export type FestivalRule = {
  type: 'festival'
  festivalCode: FestivalCode
}

export type SolarAnniversaryRule = {
  type: 'solar_anniversary'
  anniversaryYear: number | null
  solarMonth: number
  solarDay: number
}

export type ImportantDayRule = LunarBirthdayRule | FestivalRule | SolarAnniversaryRule

const gregorianMonthLengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

export type NextOccurrence = {
  nextDate: string
  daysRemaining: number
}

type CivilDate = {
  year: number
  month: number
  day: number
}

export function beijingToday(now = new Date()): CivilDate {
  const shifted = new Date(now.getTime() + BEIJING_OFFSET_MS)
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  }
}

export function describeRule(rule: ImportantDayRule): string {
  if (rule.type === 'festival') {
    return festivalDefinitions[rule.festivalCode].ruleLabel
  }
  if (rule.type === 'solar_anniversary') {
    const fallback = rule.solarMonth === 2 && rule.solarDay === 29 ? '，非闰年用2月28日' : ''
    const year = rule.anniversaryYear === null ? '' : `（起始年${rule.anniversaryYear}）`
    return `公历每年${rule.solarMonth}月${rule.solarDay}日${fallback}${year}`
  }
  const leap = rule.isLeapMonth ? '闰' : ''
  const month = lunarMonthLabels[rule.lunarMonth - 1]
  const day = lunarDayLabels[rule.lunarDay - 1]
  const year = rule.birthYear === null ? '' : `（农历出生年${rule.birthYear}）`
  return `农历每年${leap}${month}${day}${year}`
}

export function assertRule(rule: ImportantDayRule, now = new Date()): void {
  if (rule.type === 'festival') {
    if (!isFestivalCode(rule.festivalCode)) throw new ImportantDayRuleError('未知节日')
    return
  }
  if (rule.type === 'solar_anniversary') {
    assertSolarAnniversary(rule.anniversaryYear, rule.solarMonth, rule.solarDay, now)
    return
  }
  if (rule.birthYear === null) return
  assertOriginalBirthday(rule.birthYear, rule.lunarMonth, rule.lunarDay, rule.isLeapMonth, solarToday(now))
}

export function projectNext(rule: ImportantDayRule, now = new Date()): NextOccurrence {
  const today = solarToday(now)
  const occurrence =
    rule.type === 'festival'
      ? nextFestival(rule.festivalCode, today)
      : rule.type === 'solar_anniversary'
        ? nextSolar(today, (year) => solarAnniversary(year, rule.solarMonth, rule.solarDay))
        : nextLunar(rule.lunarMonth, rule.lunarDay, rule.isLeapMonth, today)
  const daysRemaining = occurrence.subtract(today)
  if (daysRemaining < 0) throw new Error('下一次日期早于今天')
  return {
    nextDate: formatIsoDate(occurrence),
    daysRemaining,
  }
}

function solarToday(now: Date): SolarDay {
  const today = beijingToday(now)
  return SolarDay.fromYmd(today.year, today.month, today.day)
}

function assertOriginalBirthday(
  birthYear: number,
  month: number,
  day: number,
  isLeapMonth: boolean,
  today: SolarDay,
): void {
  const currentLunarYear = today.getLunarDay().getYear()
  if (birthYear > currentLunarYear) {
    throw new ImportantDayRuleError('出生年份不能晚于当前农历年')
  }

  let lunarMonth: LunarMonth
  try {
    const leapMonth = LunarYear.fromYear(birthYear).getLeapMonth()
    if (isLeapMonth && leapMonth !== month) {
      throw new ImportantDayRuleError(`农历${birthYear}年没有闰${lunarMonthLabels[month - 1]}`)
    }
    lunarMonth = LunarMonth.fromYm(birthYear, isLeapMonth ? -month : month)
  } catch (error) {
    if (error instanceof ImportantDayRuleError) throw error
    throw new ImportantDayRuleError('出生日期不合法')
  }

  if (day > lunarMonth.getDayCount()) {
    const leap = isLeapMonth ? '闰' : ''
    throw new ImportantDayRuleError(
      `农历${birthYear}年${leap}${lunarMonthLabels[month - 1]}没有${lunarDayLabels[day - 1]}`,
    )
  }
}

function nextFestival(code: FestivalCode, today: SolarDay): SolarDay {
  const schedule = festivalDefinitions[code].schedule
  switch (schedule.kind) {
    case 'solar':
      return nextSolar(today, (year) => SolarDay.fromYmd(year, schedule.month, schedule.day))
    case 'lunar':
      return nextLunar(schedule.month, schedule.day, false, today)
    case 'nth_weekday':
      return nextSolar(today, (year) => nthWeekday(year, schedule.month, schedule.weekday, schedule.nth))
    case 'leap_month_day':
      return nextLeapMonthDay(today, schedule.day)
  }
}

function nextLeapMonthDay(today: SolarDay, day: number): SolarDay {
  const startYear = today.getLunarDay().getYear()
  // 闰月间隔最长约三年。nextWithin 只搜到 startYear+2，会漏掉本年闰月初十刚过、下一闰月在三年后的情况。
  for (let year = startYear; year < startYear + 8; year += 1) {
    const leapMonth = LunarYear.fromYear(year).getLeapMonth()
    if (leapMonth === 0) continue
    const occurrence = LunarDay.fromYmd(year, -leapMonth, day).getSolarDay()
    if (!occurrence.isBefore(today)) return occurrence
  }
  throw new Error('无法计算下一次日期')
}

function nextLunar(month: number, day: number, isLeapMonth: boolean, today: SolarDay): SolarDay {
  const startYear = today.getLunarDay().getYear()
  return nextWithin(startYear, (lunarYear) => lunarAnniversary(lunarYear, month, day, isLeapMonth), today)
}

function nextSolar(today: SolarDay, occurrenceInYear: (year: number) => SolarDay): SolarDay {
  return nextWithin(today.getYear(), occurrenceInYear, today)
}

function nextWithin(startYear: number, occurrenceInYear: (year: number) => SolarDay, today: SolarDay): SolarDay {
  for (let year = startYear; year < startYear + 3; year += 1) {
    const occurrence = occurrenceInYear(year)
    if (!occurrence.isBefore(today)) return occurrence
  }
  throw new Error('无法计算下一次日期')
}

function lunarAnniversary(lunarYear: number, month: number, day: number, isLeapMonth: boolean): SolarDay {
  const monthValue = resolveMonthValue(lunarYear, month, isLeapMonth)
  const resolvedDay = Math.min(day, LunarMonth.fromYm(lunarYear, monthValue).getDayCount())
  return LunarDay.fromYmd(lunarYear, monthValue, resolvedDay).getSolarDay()
}

function resolveMonthValue(lunarYear: number, month: number, isLeapMonth: boolean): number {
  if (!isLeapMonth) return month
  const leapMonth = LunarYear.fromYear(lunarYear).getLeapMonth()
  return leapMonth === month ? -month : month
}

function isGregorianLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
}

function daysInGregorianMonth(year: number, month: number): number {
  if (month === 2 && isGregorianLeapYear(year)) return 29
  return gregorianMonthLengths[month - 1] ?? 0
}

function maxSolarRuleDay(month: number): number {
  if (month === 2) return 29
  return gregorianMonthLengths[month - 1] ?? 0
}

function assertSolarAnniversary(year: number | null, month: number, day: number, now: Date): void {
  if (month < 1 || month > 12 || day < 1 || day > maxSolarRuleDay(month)) {
    throw new ImportantDayRuleError(`公历没有${month}月${day}日`)
  }
  if (year === null) return
  const today = beijingToday(now)
  if (year > today.year) {
    throw new ImportantDayRuleError('起始年不能晚于当前公历年')
  }
  if (day > daysInGregorianMonth(year, month)) {
    throw new ImportantDayRuleError(`公历${year}年没有${month}月${day}日`)
  }
}

function solarAnniversary(year: number, month: number, day: number): SolarDay {
  if (month === 2 && day === 29 && !isGregorianLeapYear(year)) {
    return SolarDay.fromYmd(year, 2, 28)
  }
  return SolarDay.fromYmd(year, month, day)
}

function nthWeekday(year: number, month: number, weekday: number, nth: number): SolarDay {
  const first = SolarDay.fromYmd(year, month, 1)
  const offset = (weekday - first.getWeek().getIndex() + 7) % 7
  return SolarDay.fromYmd(year, month, 1 + offset + (nth - 1) * 7)
}

function formatIsoDate(day: SolarDay): string {
  const year = String(day.getYear()).padStart(4, '0')
  const month = String(day.getMonth()).padStart(2, '0')
  const date = String(day.getDay()).padStart(2, '0')
  return `${year}-${month}-${date}`
}
