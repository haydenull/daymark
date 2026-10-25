import { z } from '@hono/zod-openapi'

import { festivalCodes } from '@/shared/important-day/festivals'

export const festivalCodeSchema = z.enum(festivalCodes)

const titleSchema = z.string().trim().min(1).max(50).openapi({
  example: '妈妈生日',
  description: '名称，1 到 50 个字',
})

export const lunarBirthdayInputSchema = z
  .object({
    type: z.literal('lunar_birthday').openapi({ description: '农历生日' }),
    title: titleSchema,
    birthYear: z.number().int().min(1).max(9999).nullable().openapi({
      example: 1990,
      description: '农历出生年份，可空。填写时必须是该年真实存在的农历日期',
    }),
    lunarMonth: z.number().int().min(1).max(12).openapi({ example: 4, description: '农历月，1 到 12' }),
    lunarDay: z.number().int().min(1).max(30).openapi({ example: 5, description: '农历日，1 到 30' }),
    isLeapMonth: z.boolean().openapi({ example: false, description: '是否按闰月记' }),
  })
  .openapi('LunarBirthdayInput')

export const festivalInputSchema = z
  .object({
    type: z.literal('festival').openapi({ description: '节日' }),
    festivalCode: festivalCodeSchema.openapi({ example: 'spring_festival', description: '节日代码' }),
  })
  .openapi('FestivalInput')

export const importantDayInputSchema = z
  .discriminatedUnion('type', [lunarBirthdayInputSchema, festivalInputSchema])
  .openapi('ImportantDayInput')

export const importantDaySchema = z
  .object({
    id: z.number().int().openapi({ example: 1, description: '重要日子 ID' }),
    title: z.string().openapi({ example: '妈妈生日', description: '名称' }),
    type: z.enum(['lunar_birthday', 'festival']).openapi({ example: 'lunar_birthday', description: '类型' }),
    birthYear: z.number().int().nullable().openapi({ example: 1990, description: '农历出生年份，节日为空' }),
    lunarMonth: z.number().int().nullable().openapi({ example: 4, description: '农历月，节日为空' }),
    lunarDay: z.number().int().nullable().openapi({ example: 5, description: '农历日，节日为空' }),
    isLeapMonth: z.boolean().nullable().openapi({ example: false, description: '是否闰月，节日为空' }),
    festivalCode: festivalCodeSchema.nullable().openapi({ example: null, description: '节日代码，农历生日为空' }),
    ruleLabel: z.string().openapi({ example: '农历每年四月初五（农历出生年1990）', description: '原始日期规则' }),
    nextDate: z.string().openapi({ example: '2027-05-10', description: '下一次公历日期，北京时间，含今天' }),
    daysRemaining: z.number().int().nonnegative().openapi({ example: 12, description: '距离下一次的天数，今天为 0' }),
    createdAt: z.string().openapi({ example: '2026-01-01T00:00:00.000Z', description: '创建时间' }),
    updatedAt: z.string().openapi({ example: '2026-01-01T00:00:00.000Z', description: '更新时间' }),
  })
  .openapi('ImportantDay')

export const festivalOptionSchema = z
  .object({
    code: festivalCodeSchema.openapi({ example: 'spring_festival', description: '节日代码' }),
    name: z.string().openapi({ example: '春节', description: '节日名称' }),
    ruleLabel: z.string().openapi({ example: '农历每年正月初一', description: '日期规则' }),
  })
  .openapi('FestivalOption')

export type ImportantDayInput = z.output<typeof importantDayInputSchema>
export type ImportantDayResponse = z.output<typeof importantDaySchema>
export type FestivalOption = z.output<typeof festivalOptionSchema>
