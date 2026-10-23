import { z } from 'zod'

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('production'),
  DB_FILE_NAME: z.string().default('./data/app.db'),
})

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  console.log(parsed.error.issues)
  throw new Error('There is an error with the environment variables')
}

export const ENV = parsed.data
