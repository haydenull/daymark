import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import type { FormEvent } from 'react'
import { useState } from 'react'

import { createTodo, deleteTodo, todoListQueryOptions, todoQueryKeys, updateTodo } from './-query'

export const Route = createFileRoute('/todo/')({
  component: TodoPage,
})

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : '请求失败'
}

function TodoPage() {
  const queryClient = useQueryClient()
  const list = useQuery(todoListQueryOptions())
  const [title, setTitle] = useState('')

  const invalidate = () => queryClient.invalidateQueries({ queryKey: todoQueryKeys.lists() })

  const create = useMutation({
    mutationFn: createTodo,
    onSuccess: () => {
      setTitle('')
      invalidate()
    },
  })
  const update = useMutation({
    mutationFn: ({ id, completed, title: nextTitle }: { id: number; completed?: boolean; title?: string }) =>
      updateTodo(id, { completed, title: nextTitle }),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: deleteTodo,
    onSuccess: invalidate,
  })

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const next = title.trim()
    if (!next) return
    create.mutate({ title: next })
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Todo</h1>
      <form onSubmit={onSubmit} className="mt-6 flex gap-2">
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="添加一件待办"
          aria-label="标题"
          className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
        />
        <button
          type="submit"
          disabled={create.isPending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          添加
        </button>
      </form>
      {create.isError ? <p className="mt-2 text-sm text-red-600">{errorMessage(create.error)}</p> : null}
      {update.isError ? <p className="mt-2 text-sm text-red-600">{errorMessage(update.error)}</p> : null}
      {remove.isError ? <p className="mt-2 text-sm text-red-600">{errorMessage(remove.error)}</p> : null}

      <div className="mt-8">
        {list.isPending ? (
          <p>加载中...</p>
        ) : list.isError ? (
          <p className="text-red-600">{errorMessage(list.error)}</p>
        ) : list.data.length === 0 ? (
          <p className="text-zinc-500">还没有待办</p>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {list.data.map((todo) => (
              <li key={todo.id} className="flex items-center gap-3 py-3">
                <input
                  type="checkbox"
                  checked={todo.completed}
                  aria-label={`完成 ${todo.title}`}
                  onChange={(event) => update.mutate({ id: todo.id, completed: event.target.checked })}
                />
                <span className={todo.completed ? 'flex-1 text-zinc-400 line-through' : 'flex-1'}>{todo.title}</span>
                <button
                  type="button"
                  className="text-sm text-zinc-500 hover:text-red-600"
                  onClick={() => remove.mutate(todo.id)}
                >
                  删除
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}
