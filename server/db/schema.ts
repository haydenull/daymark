import { sql } from 'drizzle-orm'
import { check, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

import { user } from './auth-schema'

export const todos = sqliteTable('todos', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  completed: integer('completed', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('createdAt', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`)
    .$defaultFn(() => new Date()),
  updatedAt: integer('updatedAt', { mode: 'timestamp' })
    .notNull()
    .default(sql`(unixepoch())`)
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date()),
})

export type Todo = typeof todos.$inferSelect
export type NewTodo = typeof todos.$inferInsert

// festivalCode 为空表示农历生日。SQLite 的 UNIQUE 把 NULL 视为互不相同，
// 因此同一用户可以保存多条生日，但不能重复保存同一个节日。
export const importantDays = sqliteTable(
  'important_days',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: text('userId')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    type: text('type', { enum: ['lunar_birthday', 'festival'] }).notNull(),
    birthYear: integer('birthYear'),
    lunarMonth: integer('lunarMonth'),
    lunarDay: integer('lunarDay'),
    isLeapMonth: integer('isLeapMonth', { mode: 'boolean' }),
    festivalCode: text('festivalCode'),
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
      ) OR (
        ${table.type} = 'festival'
        AND ${table.festivalCode} IS NOT NULL
        AND ${table.lunarMonth} IS NULL
        AND ${table.lunarDay} IS NULL
        AND ${table.isLeapMonth} IS NULL
        AND ${table.birthYear} IS NULL
      )`,
    ),
  ],
)

export type ImportantDay = typeof importantDays.$inferSelect
export type NewImportantDay = typeof importantDays.$inferInsert
