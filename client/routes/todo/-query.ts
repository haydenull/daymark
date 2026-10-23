import { queryOptions } from '@tanstack/react-query'
import { hc } from 'hono/client'

import request from '@/client/libs/request'
import type { TodoAPI } from '@/server/api/todo'
import type { CreateTodoInput, UpdateTodoInput } from '@/shared/schema/todo'

const todoClient = hc<TodoAPI>(import.meta.env.BASE_URL, { fetch: request })

export const todoQueryKeys = {
  all: ['todos'] as const,
  lists: () => [...todoQueryKeys.all, 'list'] as const,
}

export const todoListQueryOptions = () =>
  queryOptions({
    queryKey: todoQueryKeys.lists(),
    queryFn: async () => {
      const res = await todoClient.api.todo.$get()
      if (!res.ok) throw new Error(await res.text())
      return res.json()
    },
  })

export const createTodo = async (data: CreateTodoInput) => {
  const res = await todoClient.api.todo.$post({ json: data })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export const updateTodo = async (id: number, data: UpdateTodoInput) => {
  const res = await todoClient.api.todo[':id'].$patch({
    param: { id },
    json: data,
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export const deleteTodo = async (id: number) => {
  const res = await todoClient.api.todo[':id'].$delete({
    param: { id },
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}
