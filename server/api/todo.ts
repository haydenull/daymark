import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { desc, eq } from 'drizzle-orm'
import { HTTPException } from 'hono/http-exception'

import { db } from '@/server/db'
import type { Todo } from '@/server/db/schema'
import { todos } from '@/server/db/schema'
import type { DateToString } from '@/shared/schema/common'
import { errorSchema } from '@/shared/schema/common'
import { createTodoSchema, todoSchema, updateTodoSchema } from '@/shared/schema/todo'

const todoIdParamSchema = z.object({
  id: z.coerce.number().int().positive().openapi({
    description: 'Todo ID',
    example: 1,
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

function toResponse(row: Todo): DateToString<Todo> {
  return {
    id: row.id,
    title: row.title,
    completed: row.completed,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export const todo = new OpenAPIHono()
  .basePath('/api/todo')
  .openapi(
    createRoute({
      method: 'get',
      path: '/',
      tags: ['Todo'],
      summary: '获取 Todo 列表',
      responses: {
        200: {
          description: '按创建时间倒序返回 Todo 列表',
          content: {
            'application/json': {
              schema: z.array(todoSchema),
            },
          },
        },
        500: errorContent('服务器错误'),
      },
    }),
    (c) => {
      const rows = db.select().from(todos).orderBy(desc(todos.createdAt)).all()
      return c.json(rows.map(toResponse), 200)
    },
  )
  .openapi(
    createRoute({
      method: 'post',
      path: '/',
      tags: ['Todo'],
      summary: '新建 Todo',
      request: {
        body: {
          content: {
            'application/json': {
              schema: createTodoSchema,
            },
          },
        },
      },
      responses: {
        200: {
          description: '返回新建的 Todo',
          content: {
            'application/json': {
              schema: todoSchema,
            },
          },
        },
        400: errorContent('请求参数错误'),
      },
    }),
    (c) => {
      const { title } = c.req.valid('json')
      const created = db.insert(todos).values({ title }).returning().get()
      return c.json(toResponse(created), 200)
    },
  )
  .openapi(
    createRoute({
      method: 'patch',
      path: '/:id',
      tags: ['Todo'],
      summary: '更新 Todo',
      request: {
        params: todoIdParamSchema,
        body: {
          content: {
            'application/json': {
              schema: updateTodoSchema,
            },
          },
        },
      },
      responses: {
        200: {
          description: '返回更新后的 Todo',
          content: {
            'application/json': {
              schema: todoSchema,
            },
          },
        },
        400: errorContent('请求参数错误'),
        404: errorContent('Todo 不存在'),
      },
    }),
    (c) => {
      const { id } = c.req.valid('param')
      const json = c.req.valid('json')
      const existing = db.select().from(todos).where(eq(todos.id, id)).get()
      if (!existing) {
        throw new HTTPException(404, { message: 'Todo 不存在' })
      }

      const patch: { title?: string; completed?: boolean; updatedAt: Date } = {
        updatedAt: new Date(),
      }
      if (json.title !== undefined) patch.title = json.title
      if (json.completed !== undefined) patch.completed = json.completed

      const updated = db.update(todos).set(patch).where(eq(todos.id, id)).returning().get()
      return c.json(toResponse(updated), 200)
    },
  )
  .openapi(
    createRoute({
      method: 'delete',
      path: '/:id',
      tags: ['Todo'],
      summary: '删除 Todo',
      request: {
        params: todoIdParamSchema,
      },
      responses: {
        200: {
          description: '返回已删除的 Todo',
          content: {
            'application/json': {
              schema: todoSchema,
            },
          },
        },
        400: errorContent('请求参数错误'),
        404: errorContent('Todo 不存在'),
      },
    }),
    (c) => {
      const { id } = c.req.valid('param')
      const existing = db.select().from(todos).where(eq(todos.id, id)).get()
      if (!existing) {
        throw new HTTPException(404, { message: 'Todo 不存在' })
      }
      db.delete(todos).where(eq(todos.id, id)).run()
      return c.json(toResponse(existing), 200)
    },
  )

export type TodoAPI = typeof todo
