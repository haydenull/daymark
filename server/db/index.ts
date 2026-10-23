import { Database } from 'bun:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { drizzle } from 'drizzle-orm/bun-sqlite'

import { ENV } from '@/env'

import * as schema from './schema'

mkdirSync(dirname(ENV.DB_FILE_NAME), { recursive: true })

export const sqlite = new Database(ENV.DB_FILE_NAME, { create: true })

export const db = drizzle({ client: sqlite, schema })
