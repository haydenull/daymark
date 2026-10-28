import { sql } from 'drizzle-orm'
import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

import { user } from './auth-schema'

// festivalCode 为空表示农历生日或公历纪念日。SQLite 的 UNIQUE 把 NULL 视为互不相同，
// 因此同一用户可以保存多条生日和公历纪念日，但不能重复保存同一个节日。
export const importantDays = sqliteTable(
  'important_days',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    type: text('type', { enum: ['lunar_birthday', 'festival', 'solar_anniversary'] }).notNull(),
    birthYear: integer('birthYear'),
    lunarMonth: integer('lunarMonth'),
    lunarDay: integer('lunarDay'),
    isLeapMonth: integer('isLeapMonth', { mode: 'boolean' }),
    festivalCode: text('festivalCode'),
    solarMonth: integer('solarMonth'),
    solarDay: integer('solarDay'),
    anniversaryYear: integer('anniversaryYear'),
    createdAt: integer('createdAt', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`)
      .$defaultFn(() => new Date()),
    updatedAt: integer('updatedAt', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`)
      .$defaultFn(() => new Date())
      .$onUpdateFn(() => new Date()),
  },
  (table) => [
    uniqueIndex('important_days_user_festival_uq').on(table.userId, table.festivalCode),
    check(
      'important_days_rule_chk',
      sql`(
        ${table.type} = 'lunar_birthday'
        AND ${table.festivalCode} IS NULL
        AND ${table.lunarMonth} BETWEEN 1 AND 12
        AND ${table.lunarDay} BETWEEN 1 AND 30
        AND ${table.isLeapMonth} IN (0, 1)
        AND (${table.birthYear} IS NULL OR ${table.birthYear} BETWEEN 1 AND 9999)
        AND ${table.solarMonth} IS NULL
        AND ${table.solarDay} IS NULL
        AND ${table.anniversaryYear} IS NULL
      ) OR (
        ${table.type} = 'festival'
        AND ${table.festivalCode} IS NOT NULL
        AND ${table.lunarMonth} IS NULL
        AND ${table.lunarDay} IS NULL
        AND ${table.isLeapMonth} IS NULL
        AND ${table.birthYear} IS NULL
        AND ${table.solarMonth} IS NULL
        AND ${table.solarDay} IS NULL
        AND ${table.anniversaryYear} IS NULL
      ) OR (
        ${table.type} = 'solar_anniversary'
        AND ${table.festivalCode} IS NULL
        AND ${table.lunarMonth} IS NULL
        AND ${table.lunarDay} IS NULL
        AND ${table.isLeapMonth} IS NULL
        AND ${table.birthYear} IS NULL
        AND (
          (${table.solarMonth} IN (1, 3, 5, 7, 8, 10, 12) AND ${table.solarDay} BETWEEN 1 AND 31)
          OR (${table.solarMonth} IN (4, 6, 9, 11) AND ${table.solarDay} BETWEEN 1 AND 30)
          OR (${table.solarMonth} = 2 AND ${table.solarDay} BETWEEN 1 AND 29)
        )
        AND (${table.anniversaryYear} IS NULL OR ${table.anniversaryYear} BETWEEN 1 AND 9999)
      )`,
    ),
  ],
)

export type ImportantDay = typeof importantDays.$inferSelect
export type NewImportantDay = typeof importantDays.$inferInsert

export const apiTokens = sqliteTable(
  'api_tokens',
  {
    id: text('id').primaryKey(),
    userId: text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    tokenHash: text('tokenHash').notNull().unique(),
    tokenPrefix: text('tokenPrefix').notNull(),
    expiresAt: integer('expiresAt', { mode: 'timestamp' }),
    revokedAt: integer('revokedAt', { mode: 'timestamp' }),
    createdAt: integer('createdAt', { mode: 'timestamp' })
      .notNull()
      .default(sql`(unixepoch())`)
      .$defaultFn(() => new Date()),
  },
  (table) => [index('api_tokens_userId_idx').on(table.userId)],
)

export type ApiToken = typeof apiTokens.$inferSelect
export type NewApiToken = typeof apiTokens.$inferInsert
