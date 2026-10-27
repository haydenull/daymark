import { createRoute, OpenAPIHono } from '@hono/zod-openapi'

import { ENV } from '@/env'
import { errorSchema } from '@/shared/schema/common'
import { publicConfigSchema } from '@/shared/schema/config'

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

export const config = new OpenAPIHono().basePath('/api/config').openapi(
  createRoute({
    method: 'get',
    path: '/',
    tags: ['Config'],
    summary: '获取公开配置',
    responses: {
      200: {
        description: '返回当前是否开放注册',
        content: {
          'application/json': {
            schema: publicConfigSchema,
          },
        },
      },
      500: errorContent('服务器错误'),
    },
  }),
  (c) => c.json({ registrationOpen: !ENV.DISABLE_REGISTRATION }, 200),
)

export type ConfigAPI = typeof config
