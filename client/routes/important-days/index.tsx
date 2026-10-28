import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'

import { authClient } from '@/client/libs/auth-client'
import type { ImportantDayInput } from '@/shared/schema/important-day'

import type { Draft } from './-form'
import { draftFromItem, emptyDraft, ImportantDayForm } from './-form'
import {
  createImportantDay,
  deleteImportantDay,
  festivalOptionsQueryOptions,
  importantDayListQueryOptions,
  importantDayQueryKeys,
  updateImportantDay,
} from './-query'

export const Route = createFileRoute('/important-days/')({
  component: ImportantDaysPage,
})

const DAY_MS = 24 * 60 * 60 * 1000
const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000

function beijingDateKey(now = new Date()): string {
  const shifted = new Date(now.getTime() + BEIJING_OFFSET_MS)
  const year = shifted.getUTCFullYear()
  const month = String(shifted.getUTCMonth() + 1).padStart(2, '0')
  const day = String(shifted.getUTCDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function msUntilNextBeijingDate(now = new Date()): number {
  const elapsed = (now.getTime() + BEIJING_OFFSET_MS) % DAY_MS
  return elapsed === 0 ? DAY_MS : DAY_MS - elapsed
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : '请求失败'
}

function PageMain({ children }: { children: ReactNode }) {
  return <main className="mx-auto max-w-3xl px-6 py-10">{children}</main>
}

function ImportantDaysPage() {
  const session = authClient.useSession()

  if (session.isPending) {
    return (
      <PageMain>
        <p aria-live="polite">会话加载中</p>
      </PageMain>
    )
  }

  if (session.error) {
    return (
      <PageMain>
        <button type="button" className="text-sm text-red-600" onClick={() => void session.refetch()}>
          会话加载失败，重试
        </button>
      </PageMain>
    )
  }

  if (!session.data) {
    return (
      <PageMain>
        <h1 className="text-3xl font-semibold tracking-tight">重要日子</h1>
        <p className="mt-4 text-zinc-600 dark:text-zinc-300">登录后才能添加和查看自己的重要日子。</p>
        <div className="mt-6 flex gap-4">
          <Link to="/login" className="text-sm text-zinc-600 dark:text-zinc-300">
            登录
          </Link>
          <Link to="/register" className="text-sm text-zinc-600 dark:text-zinc-300">
            注册
          </Link>
        </div>
      </PageMain>
    )
  }

  return <ImportantDayEditor userId={session.data.user.id} />
}

function ImportantDayEditor({ userId }: { userId: string }) {
  const queryClient = useQueryClient()
  const list = useQuery(importantDayListQueryOptions(userId))
  const festivals = useQuery(festivalOptionsQueryOptions(userId))
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [editingId, setEditingId] = useState<number | null>(null)

  const invalidate = () => queryClient.invalidateQueries({ queryKey: importantDayQueryKeys.list(userId) })

  const save = useMutation({
    mutationFn: ({ id, input }: { id: number | null; input: ImportantDayInput }) =>
      id === null ? createImportantDay(input) : updateImportantDay(id, input),
    onSuccess: () => {
      setDraft(emptyDraft)
      setEditingId(null)
      invalidate()
    },
  })
  const remove = useMutation({
    mutationFn: deleteImportantDay,
    onSuccess: (_data, id) => {
      if (editingId === id) {
        setDraft(emptyDraft)
        setEditingId(null)
      }
      invalidate()
    },
  })

  useBeijingDateRefresh(userId)

  return (
    <PageMain>
      <h1 className="text-3xl font-semibold tracking-tight">重要日子</h1>
      <ImportantDayForm
        key={editingId ?? 'new'}
        draft={draft}
        festivals={festivals.data ?? []}
        festivalsPending={festivals.isPending}
        festivalsError={festivals.isError ? errorMessage(festivals.error) : null}
        pending={save.isPending}
        formError={save.isError ? errorMessage(save.error) : null}
        editing={editingId !== null}
        onDraftChange={setDraft}
        onSubmit={(input) => save.mutate({ id: editingId, input })}
        onCancel={() => {
          setDraft(emptyDraft)
          setEditingId(null)
          save.reset()
        }}
        onRetryFestivals={() => void festivals.refetch()}
      />
      {remove.isError ? <p className="mt-2 text-sm text-red-600">{errorMessage(remove.error)}</p> : null}
      <div className="mt-8">
        {list.isPending ? (
          <p>加载中...</p>
        ) : list.isError ? (
          <p className="text-red-600">
            {errorMessage(list.error)}{' '}
            <button type="button" className="underline" onClick={() => void list.refetch()}>
              重试
            </button>
          </p>
        ) : list.data.length === 0 ? (
          <p className="text-zinc-500">还没有重要日子</p>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {list.data.map((item) => (
              <li key={item.id} className="flex items-start gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{item.title}</span>
                    {editingId === item.id ? <span className="text-sm text-zinc-500">正在编辑</span> : null}
                  </div>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{item.ruleLabel}</p>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                    下次公历 {item.nextDate}，{item.daysRemaining === 0 ? '今天' : `剩余 ${item.daysRemaining} 天`}
                  </p>
                </div>
                {item.type === 'lunar_birthday' || item.type === 'solar_anniversary' ? (
                  <button
                    type="button"
                    className="text-sm text-zinc-500"
                    onClick={() => {
                      setDraft(draftFromItem(item))
                      setEditingId(item.id)
                      save.reset()
                    }}
                  >
                    编辑
                  </button>
                ) : null}
                <button
                  type="button"
                  className="text-sm text-zinc-500 hover:text-red-600 disabled:opacity-50"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(item.id)}
                >
                  删除
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageMain>
  )
}

function useBeijingDateRefresh(userId: string) {
  const queryClient = useQueryClient()
  const seenDate = useRef(beijingDateKey())

  useEffect(() => {
    let timer = 0
    const refreshIfDateChanged = () => {
      const today = beijingDateKey()
      if (today === seenDate.current) return
      seenDate.current = today
      void queryClient.invalidateQueries({ queryKey: importantDayQueryKeys.list(userId) })
    }
    const schedule = () => {
      timer = window.setTimeout(() => {
        refreshIfDateChanged()
        schedule()
      }, msUntilNextBeijingDate() + 1000)
    }
    schedule()
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshIfDateChanged()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [queryClient, userId])
}
