import { z } from '@hono/zod-openapi'
import type { ZodType } from 'zod'

import type { NewTodo, Todo } from '@/server/db/schema'

import type { DateToString } from './common'

export const todoSchema = z
  .object({
    id: z.number().int().openapi({ example: 1, description: 'Todo ID' }),
    title: z.string().openapi({ example: '买牛奶', description: '标题' }),
    completed: z.boolean().openapi({ example: false, description: '是否完成' }),
    createdAt: z.string().openapi({ example: '2026-01-01T00:00:00.000Z', description: '创建时间' }),
    updatedAt: z.string().openapi({ example: '2026-01-01T00:00:00.000Z', description: '更新时间' }),
  })
  .openapi('Todo') satisfies ZodType<DateToString<Todo>>

export const createTodoSchema = z
  .object({
    title: z.string().trim().min(1).openapi({ example: '买牛奶', description: '标题，不能为空' }),
  })
  .openapi('CreateTodo') satisfies ZodType<Pick<NewTodo, 'title'>>

export const updateTodoSchema = z
  .object({
    title: z.string().trim().min(1).optional().openapi({ example: '买牛奶', description: '标题' }),
    completed: z.boolean().optional().openapi({ example: true, description: '是否完成' }),
  })
  .openapi('UpdateTodo') satisfies ZodType<Partial<Pick<Todo, 'title' | 'completed'>>>

export type TodoResponse = z.output<typeof todoSchema>
export type CreateTodoInput = z.output<typeof createTodoSchema>
export type UpdateTodoInput = z.output<typeof updateTodoSchema>
