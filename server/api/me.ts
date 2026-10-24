import { createRoute, OpenAPIHono } from '@hono/zod-openapi'

import type { AuthUser } from '@/server/middleware/require-auth'
import { currentUser, requireAuth } from '@/server/middleware/require-auth'
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

const meRoutes = new OpenAPIHono<{ Variables: { user: AuthUser } }>().basePath('/api/me')

meRoutes.use(requireAuth)

export const me = meRoutes.openapi(
  createRoute({
    method: 'get',
    path: '/',
    tags: ['Auth'],
    summary: '获取当前用户',
    responses: {
      200: {
        description: '返回当前登录用户的基本信息',
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
