import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { HTTPException } from 'hono/http-exception'

import { createApiTokenValue, DEFAULT_TOKEN_TTL_MS } from '@/server/api-token'
import { db } from '@/server/db'
import type { ApiToken } from '@/server/db/schema'
import { apiTokens } from '@/server/db/schema'
import type { AuthEnv } from '@/server/middleware/require-auth'
import { assertTrustedOrigin, cookieAuthSecurity, currentUser, requireSession } from '@/server/middleware/require-auth'
import type { ApiTokenResponse, CreatedApiTokenResponse } from '@/shared/schema/api-token'
import { apiTokenSchema, createApiTokenSchema, createdApiTokenSchema } from '@/shared/schema/api-token'
import { errorSchema } from '@/shared/schema/common'

const tokenIdParamSchema = z.object({
  id: z.string().uuid().openapi({
    description: '令牌 ID',
    example: '3f1c0a6e-2c4b-4d1a-9f0e-1a2b3c4d5e6f',
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

function toResponse(row: ApiToken): ApiTokenResponse {
  return {
    id: row.id,
    name: row.name,
    tokenPrefix: row.tokenPrefix,
    expiresAt: row.expiresAt ? row.expiresAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  }
}

function toCreatedResponse(row: ApiToken, token: string): CreatedApiTokenResponse {
  return {
    ...toResponse(row),
    token,
  }
}

function ownedActiveToken(userId: string, id: string): ApiToken {
  const row = db
    .select()
    .from(apiTokens)
    .where(and(eq(apiTokens.id, id), eq(apiTokens.userId, userId), isNull(apiTokens.revokedAt)))
    .get()
  if (!row) throw new HTTPException(404, { message: '令牌不存在' })
  return row
}

const tokenRoutes = new OpenAPIHono<AuthEnv>({
  defaultHook: (result, c) => {
    if (!result.success) {
      return c.json({ code: 400, message: '请求参数错误' }, 400)
    }
  },
}).basePath('/api/token')

tokenRoutes.use(requireSession)
tokenRoutes.use(async (c, next) => {
  if (c.req.method !== 'GET' && c.req.method !== 'HEAD') {
    assertTrustedOrigin(c)
  }
  await next()
})

export const token = tokenRoutes
  .openapi(
    createRoute({
      method: 'get',
      path: '/',
      tags: ['ApiToken'],
      summary: '列出当前用户的 API Token',
      security: cookieAuthSecurity,
      responses: {
        200: {
          description: '返回未撤销的令牌元数据，不含完整令牌',
          content: {
            'application/json': {
              schema: z.array(apiTokenSchema),
            },
          },
        },
        401: errorContent('未登录'),
      },
    }),
    (c) => {
      const user = currentUser(c)
      const rows = db
        .select()
        .from(apiTokens)
        .where(and(eq(apiTokens.userId, user.id), isNull(apiTokens.revokedAt)))
        .orderBy(desc(apiTokens.createdAt))
        .all()
      return c.json(rows.map(toResponse), 200)
    },
  )
  .openapi(
    createRoute({
      method: 'post',
      path: '/',
      tags: ['ApiToken'],
      summary: '创建 API Token',
      description: '完整令牌只在本次响应中返回一次。默认 90 天后过期，可选择永不过期。',
      security: cookieAuthSecurity,
      request: {
        body: {
          content: {
            'application/json': {
              schema: createApiTokenSchema,
            },
          },
        },
      },
      responses: {
        200: {
          description: '返回新建令牌，包含完整值',
          content: {
            'application/json': {
              schema: createdApiTokenSchema,
            },
          },
        },
        400: errorContent('请求参数错误'),
        401: errorContent('未登录'),
        403: errorContent('请求来源不被允许'),
      },
    }),
    (c) => {
      const user = currentUser(c)
      const input = c.req.valid('json')
      const now = new Date()
      const generated = createApiTokenValue()
      const created = db
        .insert(apiTokens)
        .values({
          id: crypto.randomUUID(),
          userId: user.id,
          name: input.name,
          tokenHash: generated.hash,
          tokenPrefix: generated.prefix,
          expiresAt: input.neverExpires ? null : new Date(now.getTime() + DEFAULT_TOKEN_TTL_MS),
          createdAt: now,
        })
        .returning()
        .get()
      return c.json(toCreatedResponse(created, generated.token), 200)
    },
  )
  .openapi(
    createRoute({
      method: 'delete',
      path: '/:id',
      tags: ['ApiToken'],
      summary: '撤销 API Token',
      security: cookieAuthSecurity,
      request: {
        params: tokenIdParamSchema,
      },
      responses: {
        200: {
          description: '返回已撤销的令牌元数据',
          content: {
            'application/json': {
              schema: apiTokenSchema,
            },
          },
        },
        400: errorContent('请求参数错误'),
        401: errorContent('未登录'),
        403: errorContent('请求来源不被允许'),
        404: errorContent('令牌不存在'),
      },
    }),
    (c) => {
      const user = currentUser(c)
      const { id } = c.req.valid('param')
      const existing = ownedActiveToken(user.id, id)
      db.update(apiTokens).set({ revokedAt: new Date() }).where(eq(apiTokens.id, id)).run()
      return c.json(toResponse(existing), 200)
    },
  )

export type TokenAPI = typeof token
