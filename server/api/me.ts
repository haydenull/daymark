import { createRoute, OpenAPIHono } from '@hono/zod-openapi'

import type { AuthEnv } from '@/server/middleware/require-auth'
import { cookieOrBearerSecurity, currentUser, requireAuth } from '@/server/middleware/require-auth'
import { currentUserSchema } from '@/shared/schema/auth'
import { errorSchema } from '@/shared/schema/common'

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

const meRoutes = new OpenAPIHono<AuthEnv>().basePath('/api/me')

meRoutes.use(requireAuth)

export const me = meRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/',
    tags: ['Auth'],
    summary: '获取当前用户',
    description:
      '可用网页登录 Cookie，或 Authorization: Bearer <token>。只要带 Authorization，就只验证 Bearer，失败返回 401，不会回退 Cookie。',
    security: cookieOrBearerSecurity,
    responses: {
      200: {
        description: '返回当前登录用户的基本信息。示例：Authorization: Bearer dm_exampleOnlyNotARealToken',
        content: {
          'application/json': {
            schema: currentUserSchema,
          },
        },
      },
      401: errorContent('未登录'),
    },
  }),
  (c) => {
    const user = currentUser(c)
    return c.json(user, 200)
  },
)

export type MeAPI = typeof me
