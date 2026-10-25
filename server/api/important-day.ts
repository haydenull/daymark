import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { and, eq } from 'drizzle-orm'
import { HTTPException } from 'hono/http-exception'

import { db } from '@/server/db'
import type { ImportantDay } from '@/server/db/schema'
import { importantDays } from '@/server/db/schema'
import type { ImportantDayRule } from '@/server/important-day/calendar'
import { assertRule, describeRule, ImportantDayRuleError, projectNext } from '@/server/important-day/calendar'
import type { AuthUser } from '@/server/middleware/require-auth'
import { currentUser, requireAuth } from '@/server/middleware/require-auth'
import { isFestivalCode, listFestivalOptions } from '@/shared/important-day/festivals'
import { errorSchema } from '@/shared/schema/common'
import type { ImportantDayInput, ImportantDayResponse } from '@/shared/schema/important-day'
import { festivalOptionSchema, importantDayInputSchema, importantDaySchema } from '@/shared/schema/important-day'

const importantDayIdParamSchema = z.object({
  id: z.coerce.number().int().positive().openapi({
    description: '重要日子 ID',
    example: 1,
  }),
})

function errorContent(description: string) {
  return {
    description,
    content: {
      'application/json': {
        schema: errorSchema,
      },
    },
  }
}

function ruleFromInput(input: ImportantDayInput): ImportantDayRule {
  if (input.type === 'festival') {
    return { type: 'festival', festivalCode: input.festivalCode }
  }
  return {
    type: 'lunar_birthday',
    birthYear: input.birthYear,
    lunarMonth: input.lunarMonth,
    lunarDay: input.lunarDay,
    isLeapMonth: input.isLeapMonth,
  }
}

function ruleFromRow(row: ImportantDay): ImportantDayRule {
  if (row.type === 'festival') {
    if (row.festivalCode === null || !isFestivalCode(row.festivalCode)) {
      throw new Error('重要日子节日数据不完整')
    }
    return { type: 'festival', festivalCode: row.festivalCode }
  }
  if (row.lunarMonth === null || row.lunarDay === null || row.isLeapMonth === null) {
    throw new Error('重要日子生日数据不完整')
  }
  return {
    type: 'lunar_birthday',
    birthYear: row.birthYear,
    lunarMonth: row.lunarMonth,
    lunarDay: row.lunarDay,
    isLeapMonth: row.isLeapMonth,
  }
}

function storedValues(userId: string, input: ImportantDayInput) {
  if (input.type === 'festival') {
    return {
      userId,
      title: input.title,
      type: input.type,
      birthYear: null,
      lunarMonth: null,
      lunarDay: null,
      isLeapMonth: null,
      festivalCode: input.festivalCode,
    }
  }
  return {
    userId,
    title: input.title,
    type: input.type,
    birthYear: input.birthYear,
    lunarMonth: input.lunarMonth,
    lunarDay: input.lunarDay,
    isLeapMonth: input.isLeapMonth,
    festivalCode: null,
  }
}

function toResponse(row: ImportantDay, now: Date): ImportantDayResponse {
  const rule = ruleFromRow(row)
  const projected = projectNext(rule, now)
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    birthYear: row.birthYear,
    lunarMonth: row.lunarMonth,
    lunarDay: row.lunarDay,
    isLeapMonth: row.isLeapMonth,
    festivalCode: rule.type === 'festival' ? rule.festivalCode : null,
    ruleLabel: describeRule(rule),
    nextDate: projected.nextDate,
    daysRemaining: projected.daysRemaining,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

function assertKnownRule(input: ImportantDayInput, now: Date) {
  try {
    assertRule(ruleFromInput(input), now)
  } catch (error) {
    if (error instanceof ImportantDayRuleError) {
      throw new HTTPException(400, { message: error.message })
    }
    throw error
  }
}

function assertFestivalAvailable(userId: string, input: ImportantDayInput, excludeId?: number) {
  if (input.type !== 'festival') return
  const existing = db
    .select({ id: importantDays.id })
    .from(importantDays)
    .where(and(eq(importantDays.userId, userId), eq(importantDays.festivalCode, input.festivalCode)))
    .get()
  if (existing && existing.id !== excludeId) {
    throw new HTTPException(409, { message: '该节日已存在' })
  }
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const record = error as { code?: unknown; message?: unknown }
  const code = typeof record.code === 'string' ? record.code : ''
  const message = typeof record.message === 'string' ? record.message : ''
  return code === 'SQLITE_CONSTRAINT_UNIQUE' || message.includes('UNIQUE constraint failed')
}

function writeRow(action: () => ImportantDay): ImportantDay {
  try {
    return action()
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new HTTPException(409, { message: '该节日已存在' })
    }
    throw error
  }
}

function ownedDay(userId: string, id: number): ImportantDay {
  const row = db
    .select()
    .from(importantDays)
    .where(and(eq(importantDays.id, id), eq(importantDays.userId, userId)))
    .get()
  if (!row) throw new HTTPException(404, { message: '重要日子不存在' })
  return row
}

const importantDayRoutes = new OpenAPIHono<{ Variables: { user: AuthUser } }>({
  defaultHook: (result, c) => {
    if (!result.success) {
      return c.json({ code: 400, message: '请求参数错误' }, 400)
    }
  },
}).basePath('/api/important-day')

importantDayRoutes.use(requireAuth)

export const importantDay = importantDayRoutes
  .openapi(
    createRoute({
      method: 'get',
      path: '/',
      tags: ['ImportantDay'],
      summary: '获取当前用户的重要日子',
      responses: {
        200: {
          description: '按剩余天数从近到远返回，今天的剩余天数为 0',
          content: {
            'application/json': {
              schema: z.array(importantDaySchema),
            },
          },
        },
        401: errorContent('未登录'),
        500: errorContent('服务器错误'),
      },
    }),
    (c) => {
      const user = currentUser(c)
      const now = new Date()
      const rows = db.select().from(importantDays).where(eq(importantDays.userId, user.id)).all()
      const items = rows.map((row) => toResponse(row, now))
      items.sort((left, right) => left.daysRemaining - right.daysRemaining || left.id - right.id)
      return c.json(items, 200)
    },
  )
  .openapi(
    createRoute({
      method: 'get',
      path: '/festivals',
      tags: ['ImportantDay'],
      summary: '获取可添加的节日',
      responses: {
        200: {
          description: '返回七个每年重复的节日',
          content: {
            'application/json': {
              schema: z.array(festivalOptionSchema),
            },
          },
        },
        401: errorContent('未登录'),
      },
    }),
    (c) => {
      currentUser(c)
      return c.json(listFestivalOptions(), 200)
    },
  )
  .openapi(
    createRoute({
      method: 'post',
      path: '/',
      tags: ['ImportantDay'],
      summary: '新建重要日子',
      request: {
        body: {
          content: {
            'application/json': {
              schema: importantDayInputSchema,
            },
          },
        },
      },
      responses: {
        200: {
          description: '返回新建的重要日子',
          content: {
            'application/json': {
              schema: importantDaySchema,
            },
          },
        },
        400: errorContent('请求参数错误'),
        401: errorContent('未登录'),
        409: errorContent('该节日已存在'),
      },
    }),
    (c) => {
      const user = currentUser(c)
      const input = c.req.valid('json')
      const now = new Date()
      assertKnownRule(input, now)
      assertFestivalAvailable(user.id, input)
      const created = writeRow(() => db.insert(importantDays).values(storedValues(user.id, input)).returning().get())
      return c.json(toResponse(created, now), 200)
    },
  )
  .openapi(
    createRoute({
      method: 'patch',
      path: '/:id',
      tags: ['ImportantDay'],
      summary: '更新重要日子',
      request: {
        params: importantDayIdParamSchema,
        body: {
          content: {
            'application/json': {
              schema: importantDayInputSchema,
            },
          },
        },
      },
      responses: {
        200: {
          description: '返回更新后的重要日子',
          content: {
            'application/json': {
              schema: importantDaySchema,
            },
          },
        },
        400: errorContent('请求参数错误'),
        401: errorContent('未登录'),
        404: errorContent('重要日子不存在'),
        409: errorContent('该节日已存在'),
      },
    }),
    (c) => {
      const user = currentUser(c)
      const { id } = c.req.valid('param')
      const input = c.req.valid('json')
      ownedDay(user.id, id)
      const now = new Date()
      assertKnownRule(input, now)
      assertFestivalAvailable(user.id, input, id)
      const updated = writeRow(() =>
        db
          .update(importantDays)
          .set({ ...storedValues(user.id, input), updatedAt: now })
          .where(and(eq(importantDays.id, id), eq(importantDays.userId, user.id)))
          .returning()
          .get(),
      )
      return c.json(toResponse(updated, now), 200)
    },
  )
  .openapi(
    createRoute({
      method: 'delete',
      path: '/:id',
      tags: ['ImportantDay'],
      summary: '删除重要日子',
      request: {
        params: importantDayIdParamSchema,
      },
      responses: {
        200: {
          description: '返回已删除的重要日子',
          content: {
            'application/json': {
              schema: importantDaySchema,
            },
          },
        },
        400: errorContent('请求参数错误'),
        401: errorContent('未登录'),
        404: errorContent('重要日子不存在'),
      },
    }),
    (c) => {
      const user = currentUser(c)
      const { id } = c.req.valid('param')
      const now = new Date()
      const existing = ownedDay(user.id, id)
      const response = toResponse(existing, now)
      db.delete(importantDays)
        .where(and(eq(importantDays.id, id), eq(importantDays.userId, user.id)))
        .run()
      return c.json(response, 200)
    },
  )

export type ImportantDayAPI = typeof importantDay
