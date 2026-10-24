import { z } from '@hono/zod-openapi'

export const currentUserSchema = z
  .object({
    id: z.string().openapi({ description: '用户 ID' }),
    name: z.string().openapi({ example: 'Ada', description: '昵称' }),
    email: z.string().openapi({ example: 'ada@example.com', description: '邮箱' }),
  })
  .openapi('CurrentUser')

export type CurrentUser = z.output<typeof currentUserSchema>
