import { z } from '@hono/zod-openapi'

export const createApiTokenSchema = z
  .object({
    name: z.string().trim().min(1).max(50).openapi({
      example: 'CI',
      description: '令牌名称',
    }),
    neverExpires: z.boolean().optional().openapi({
      example: false,
      description: '为 true 时永不过期；默认 90 天',
    }),
  })
  .openapi('CreateApiToken')

export const apiTokenSchema = z
  .object({
    id: z.string().openapi({ example: '3f1c0a6e-2c4b-4d1a-9f0e-1a2b3c4d5e6f', description: '令牌 ID' }),
    name: z.string().openapi({ example: 'CI', description: '令牌名称' }),
    tokenPrefix: z.string().openapi({ example: 'dm_abc123xy', description: '令牌前缀，用于辨认' }),
    expiresAt: z.string().nullable().openapi({
      example: '2026-01-24T00:00:00.000Z',
      description: '过期时间；null 表示永不过期',
    }),
    createdAt: z.string().openapi({ example: '2026-01-01T00:00:00.000Z', description: '创建时间' }),
  })
  .openapi('ApiToken')

export const createdApiTokenSchema = apiTokenSchema
  .extend({
    token: z.string().openapi({
      example: 'dm_exampleOnlyNotARealToken',
      description: '完整令牌，只在创建时返回一次',
    }),
  })
  .openapi('CreatedApiToken')

export type CreateApiTokenInput = z.output<typeof createApiTokenSchema>
export type ApiTokenResponse = z.output<typeof apiTokenSchema>
export type CreatedApiTokenResponse = z.output<typeof createdApiTokenSchema>
