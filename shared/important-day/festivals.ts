export const festivalCodes = [
  'valentines_day',
  'womens_day',
  'spring_festival',
  'qixi',
  'mid_autumn',
  'mothers_day',
  'fathers_day',
  'leap_month_shoes',
] as const

export type FestivalCode = (typeof festivalCodes)[number]

type SolarSchedule = { readonly kind: 'solar'; readonly month: number; readonly day: number }
type LunarSchedule = { readonly kind: 'lunar'; readonly month: number; readonly day: number }
// weekday 0 是星期日，与 tyme4ts Week 的索引一致。
type NthWeekdaySchedule = {
  readonly kind: 'nth_weekday'
  readonly month: number
  readonly weekday: 0
  readonly nth: number
}
type LeapMonthDaySchedule = { readonly kind: 'leap_month_day'; readonly day: number }

type FestivalBody = {
  readonly name: string
  readonly ruleLabel: string
  readonly schedule: SolarSchedule | LunarSchedule | NthWeekdaySchedule | LeapMonthDaySchedule
}

// 节日规则由应用定义。tyme4ts 的节日索引不含情人节、母亲节和父亲节。
export const festivalDefinitions = {
  valentines_day: {
    name: '情人节',
    ruleLabel: '公历每年2月14日',
    schedule: { kind: 'solar', month: 2, day: 14 },
  },
  womens_day: {
    name: '妇女节',
    ruleLabel: '公历每年3月8日',
    schedule: { kind: 'solar', month: 3, day: 8 },
  },
  spring_festival: {
    name: '春节',
    ruleLabel: '农历每年正月初一',
    schedule: { kind: 'lunar', month: 1, day: 1 },
  },
  qixi: {
    name: '七夕',
    ruleLabel: '农历每年七月初七',
    schedule: { kind: 'lunar', month: 7, day: 7 },
  },
  mid_autumn: {
    name: '中秋',
    ruleLabel: '农历每年八月十五',
    schedule: { kind: 'lunar', month: 8, day: 15 },
  },
  mothers_day: {
    name: '母亲节',
    ruleLabel: '公历每年5月第二个星期日',
    schedule: { kind: 'nth_weekday', month: 5, weekday: 0, nth: 2 },
  },
  fathers_day: {
    name: '父亲节',
    ruleLabel: '公历每年6月第三个星期日',
    schedule: { kind: 'nth_weekday', month: 6, weekday: 0, nth: 3 },
  },
  leap_month_shoes: {
    name: '闰月鞋',
    ruleLabel: '农历闰月初十，无闰月年份跳过',
    schedule: { kind: 'leap_month_day', day: 10 },
  },
} as const satisfies Record<FestivalCode, FestivalBody>

export function isFestivalCode(code: string): code is FestivalCode {
  return festivalCodes.some((item) => item === code)
}

export function listFestivalOptions() {
  return festivalCodes.map((code) => {
    const definition = festivalDefinitions[code]
    return {
      code,
      name: definition.name,
      ruleLabel: definition.ruleLabel,
    }
  })
}
