import { z } from '@hono/zod-openapi'

export const publicConfigSchema = z
  .object({
    registrationOpen: z.boolean().openapi({
      example: true,
      description: '是否开放邮箱密码注册',
    }),
  })
  .openapi('PublicConfig')

export type PublicConfig = z.output<typeof publicConfigSchema>
