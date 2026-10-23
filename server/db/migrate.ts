import { migrate } from 'drizzle-orm/bun-sqlite/migrator'

import { db, sqlite } from './index'

migrate(db, { migrationsFolder: './drizzle' })
sqlite.close()
