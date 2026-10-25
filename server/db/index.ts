import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { drizzle } from 'drizzle-orm/bun-sqlite'

import { ENV } from '@/env'

import * as authSchema from './auth-schema'
import * as schema from './schema'

mkdirSync(dirname(ENV.DB_FILE_NAME), { recursive: true })

export const sqlite = new Database(ENV.DB_FILE_NAME, { create: true })
// 启用后，重要日子的 userId 外键才会限制为已有用户，并在删除用户时级联删除。
sqlite.exec('PRAGMA foreign_keys = ON')

export const db = drizzle({ client: sqlite, schema: { ...schema, ...authSchema } })
