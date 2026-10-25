// 预期公历日期抄自香港天文台公历农历对照表，不用 tyme4ts，也不调用 server/important-day/calendar.ts。
// https://www.hko.gov.hk/en/gts/time/calendar/text/files/T2025e.txt
// https://www.hko.gov.hk/en/gts/time/calendar/text/files/T2026e.txt
// https://www.hko.gov.hk/en/gts/time/calendar/text/files/T2027e.txt
//
// 对照表同一年出现两次 “6th Lunar Month” 时，后者是闰月。
// T2025e：2025-06-25 为第一个六月初一，2025-07-24 为六月三十，2025-07-25 再次进入六月，
// 2025-08-22 为该月廿九，2025-08-23 为七月初一。北京天文馆说明 2025-07-25 至 2025-08-22 是闰六月，且为 29 天小月：
// https://www.bjp.org.cn/xwzx/gndt/4028c136984d78ec01984f087d4b000b.shtml
//
// T2026e 全年只有一个 6th Lunar Month，初一是 2026-07-14。
// 2026-01-19 为十二月初一，2026-02-07 为二十，2026-02-16 为廿九，2026-02-17 为正月初一。
// 因此 2026-01-15 仍属于上一农历年；若误从公历年 2026 起算，腊月二十会落到 T2027e 的 2027-01-27。
// 2026-04-17 为三月初一，2026-04-21 为三月初五。
// 2026-08-13 为七月初一，2026-08-19 为七月初七。2026-09-11 为八月初一，2026-09-25 为八月十五。
// 2026-05-03 与 2026-05-10 都是星期日，母亲节是 2026-05-10。
// 2026-06-07 与 2026-06-21 都是星期日，父亲节是 2026-06-21。
// T2027e：2027-02-06 为正月初一。情人节、妇女节按公历规则取下一次，2026 年不是闰年。
// T2026e、T2027e 全年都没有重复的农历月，因此这两年没有闰月。
// T2026e：2026-07-14 为六月初一，普通六月初十是 2026-07-23。
// https://www.hko.gov.hk/en/gts/time/calendar/text/files/T2028e.txt
// T2028e 出现两次 “5th Lunar Month”：2028-05-24 为第一个五月初一，2028-06-22 为五月三十，
// 2028-06-23 再次进入五月，2028-07-02 为该月初十，2028-07-21 为廿九，2028-07-22 为六月初一。
// T2025e 第二个六月初一是 2025-07-25，2025-08-03 为该月初十；普通六月初十是 2025-07-04。

export const lunarSamples = {
  ordinary: {
    today: '2026-03-01',
    title: '春日',
    month: '3',
    day: '5',
    ruleLabel: '农历每年三月初五',
    nextDate: '2026-04-21',
  },
  leapMonth: {
    today: '2025-06-20',
    title: '闰月初一',
    month: '6',
    day: '1',
    ruleLabel: '农历每年闰六月初一',
    nextDate: '2025-07-25',
    regularMonthDate: '2025-06-25',
  },
  leapShortMonth: {
    today: '2025-06-20',
    title: '闰月三十',
    month: '6',
    day: '30',
    ruleLabel: '农历每年闰六月三十',
    nextDate: '2025-08-22',
    regularThirtyDate: '2025-07-24',
  },
  noLeapFallback: {
    today: '2026-03-01',
    title: '平月回退',
    month: '6',
    day: '1',
    ruleLabel: '农历每年闰六月初一',
    nextDate: '2026-07-14',
  },
  previousLunarYear: {
    today: '2026-01-15',
    title: '腊月二十',
    month: '12',
    day: '20',
    ruleLabel: '农历每年腊月二十',
    nextDate: '2026-02-07',
    followingLunarYearDate: '2027-01-27',
  },
  shortTwelfthMonth: {
    today: '2026-01-15',
    title: '腊月三十',
    month: '12',
    day: '30',
    ruleLabel: '农历每年腊月三十',
    nextDate: '2026-02-16',
  },
} as const

export const festivalSamples = {
  today: '2026-03-01',
  items: [
    {
      code: 'womens_day',
      title: '妇女节',
      ruleLabel: '公历每年3月8日',
      nextDate: '2026-03-08',
    },
    {
      code: 'mothers_day',
      title: '母亲节',
      ruleLabel: '公历每年5月第二个星期日',
      nextDate: '2026-05-10',
    },
    {
      code: 'fathers_day',
      title: '父亲节',
      ruleLabel: '公历每年6月第三个星期日',
      nextDate: '2026-06-21',
    },
    {
      code: 'qixi',
      title: '七夕',
      ruleLabel: '农历每年七月初七',
      nextDate: '2026-08-19',
    },
    {
      code: 'mid_autumn',
      title: '中秋',
      ruleLabel: '农历每年八月十五',
      nextDate: '2026-09-25',
    },
    {
      code: 'spring_festival',
      title: '春节',
      ruleLabel: '农历每年正月初一',
      nextDate: '2027-02-06',
    },
    {
      code: 'valentines_day',
      title: '情人节',
      ruleLabel: '公历每年2月14日',
      nextDate: '2027-02-14',
    },
  ],
} as const

export const leapMonthShoesSamples = {
  title: '闰月鞋',
  ruleLabel: '农历闰月初十，无闰月年份跳过',
  withLeapMonth: {
    today: '2025-06-20',
    nextDate: '2025-08-03',
    regularMonthTenth: '2025-07-04',
  },
  noLeapYear: {
    today: '2026-03-01',
    nextDate: '2028-07-02',
    skippedRegularTenth: '2026-07-23',
  },
  onTheDay: {
    today: '2025-08-03',
    nextDate: '2025-08-03',
  },
  afterLeapMonth: {
    today: '2025-08-04',
    nextDate: '2028-07-02',
  },
} as const

export const sortSamples = {
  today: '2026-02-14',
  nextDay: '2026-02-15',
  createOrder: ['妇女节', '春节', '正月初一', '情人节'] as const,
  todayOrder: [
    { title: '情人节', ruleLabel: '公历每年2月14日', nextDate: '2026-02-14', daysRemaining: 0 },
    { title: '春节', ruleLabel: '农历每年正月初一', nextDate: '2026-02-17', daysRemaining: 3 },
    { title: '正月初一', ruleLabel: '农历每年正月初一', nextDate: '2026-02-17', daysRemaining: 3 },
    { title: '妇女节', ruleLabel: '公历每年3月8日', nextDate: '2026-03-08', daysRemaining: 22 },
  ],
  nextDayOrder: [
    { title: '春节', ruleLabel: '农历每年正月初一', nextDate: '2026-02-17', daysRemaining: 2 },
    { title: '正月初一', ruleLabel: '农历每年正月初一', nextDate: '2026-02-17', daysRemaining: 2 },
    { title: '妇女节', ruleLabel: '公历每年3月8日', nextDate: '2026-03-08', daysRemaining: 21 },
    { title: '情人节', ruleLabel: '公历每年2月14日', nextDate: '2027-02-14', daysRemaining: 364 },
  ],
} as const
