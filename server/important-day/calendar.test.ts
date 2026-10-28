import { describe, expect, it } from 'vitest'

import type { SolarAnniversaryRule } from './calendar'
import { assertRule, describeRule, ImportantDayRuleError, projectNext } from './calendar'

function atBeijingNoon(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00+08:00`)
}

function daysBetween(earlierIsoDate: string, laterIsoDate: string): number {
  const earlier = Date.parse(`${earlierIsoDate}T00:00:00Z`)
  const later = Date.parse(`${laterIsoDate}T00:00:00Z`)
  return Math.round((later - earlier) / 86_400_000)
}

function solar(
  partial: Partial<SolarAnniversaryRule> & Pick<SolarAnniversaryRule, 'solarMonth' | 'solarDay'>,
): SolarAnniversaryRule {
  return {
    type: 'solar_anniversary',
    anniversaryYear: null,
    ...partial,
  }
}

describe('公历纪念日', () => {
  it('接受起始年并计算下一次公历日期', () => {
    const rule = solar({ anniversaryYear: 2021, solarMonth: 5, solarDay: 27 })
    const now = atBeijingNoon('2026-10-28')

    expect(() => assertRule(rule, now)).not.toThrow()
    expect(describeRule(rule)).toBe('公历每年5月27日（起始年2021）')
    expect(projectNext(rule, now)).toEqual({
      nextDate: '2027-05-27',
      daysRemaining: daysBetween('2026-10-28', '2027-05-27'),
    })
  })

  it('跨年时当天算这次，次日进入下一年', () => {
    const rule = solar({ solarMonth: 5, solarDay: 27 })

    expect(projectNext(rule, atBeijingNoon('2026-05-27'))).toEqual({
      nextDate: '2026-05-27',
      daysRemaining: 0,
    })
    expect(projectNext(rule, atBeijingNoon('2026-05-28'))).toEqual({
      nextDate: '2027-05-27',
      daysRemaining: daysBetween('2026-05-28', '2027-05-27'),
    })
    expect(projectNext(rule, atBeijingNoon('2026-12-31')).nextDate).toBe('2027-05-27')
    expect(projectNext(solar({ solarMonth: 1, solarDay: 1 }), atBeijingNoon('2026-12-31'))).toEqual({
      nextDate: '2027-01-01',
      daysRemaining: 1,
    })
  })

  it('2月29日在闰年用29日，非闰年回退到2月28日', () => {
    const rule = solar({ anniversaryYear: 2000, solarMonth: 2, solarDay: 29 })

    expect(describeRule(rule)).toBe('公历每年2月29日，非闰年用2月28日（起始年2000）')
    expect(describeRule(solar({ solarMonth: 2, solarDay: 29 }))).toBe('公历每年2月29日，非闰年用2月28日')
    expect(projectNext(rule, atBeijingNoon('2024-02-29'))).toMatchObject({ nextDate: '2024-02-29', daysRemaining: 0 })
    expect(projectNext(rule, atBeijingNoon('2024-03-01')).nextDate).toBe('2025-02-28')
    expect(projectNext(rule, atBeijingNoon('2025-02-28')).nextDate).toBe('2025-02-28')
    expect(projectNext(rule, atBeijingNoon('2025-03-01')).nextDate).toBe('2026-02-28')
    expect(projectNext(rule, atBeijingNoon('2027-03-01')).nextDate).toBe('2028-02-29')
    expect(projectNext(rule, atBeijingNoon('2028-02-28')).nextDate).toBe('2028-02-29')
    expect(projectNext(rule, atBeijingNoon('1900-02-28')).nextDate).toBe('1900-02-28')
    expect(projectNext(rule, atBeijingNoon('1900-03-01')).nextDate).toBe('1901-02-28')
    expect(projectNext(rule, atBeijingNoon('2000-02-29')).nextDate).toBe('2000-02-29')
  })

  it('拒绝不存在的月日、非闰起始年和未来起始年', () => {
    const now = atBeijingNoon('2026-05-01')

    expect(() => assertRule(solar({ solarMonth: 4, solarDay: 31 }), now)).toThrow(ImportantDayRuleError)
    expect(() => assertRule(solar({ solarMonth: 4, solarDay: 31 }), now)).toThrow('公历没有4月31日')
    expect(() => assertRule(solar({ solarMonth: 2, solarDay: 30 }), now)).toThrow('公历没有2月30日')
    expect(() => assertRule(solar({ anniversaryYear: 2021, solarMonth: 2, solarDay: 29 }), now)).toThrow(
      '公历2021年没有2月29日',
    )
    expect(() => assertRule(solar({ anniversaryYear: 1900, solarMonth: 2, solarDay: 29 }), now)).toThrow(
      '公历1900年没有2月29日',
    )
    expect(() => assertRule(solar({ anniversaryYear: 2020, solarMonth: 2, solarDay: 29 }), now)).not.toThrow()
    expect(() => assertRule(solar({ anniversaryYear: 2027, solarMonth: 5, solarDay: 27 }), now)).toThrow(
      '起始年不能晚于当前公历年',
    )
    expect(() => assertRule(solar({ anniversaryYear: 2026, solarMonth: 5, solarDay: 27 }), now)).not.toThrow()
  })

  it('不改变农历生日的下一次日期', () => {
    expect(
      projectNext(
        {
          type: 'lunar_birthday',
          birthYear: null,
          lunarMonth: 3,
          lunarDay: 5,
          isLeapMonth: false,
        },
        atBeijingNoon('2026-03-01'),
      ),
    ).toMatchObject({ nextDate: '2026-04-21' })
  })
})
