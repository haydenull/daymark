import { queryOptions, useQueryClient } from '@tanstack/react-query'
import { hc } from 'hono/client'
import { useEffect, useRef } from 'react'

import request from '@/client/libs/request'
import type { ImportantDayAPI } from '@/server/api/important-day'
import type { FestivalOption, ImportantDayInput, ImportantDayResponse } from '@/shared/schema/important-day'

const importantDayClient = hc<ImportantDayAPI>(import.meta.env.BASE_URL, { fetch: request })

export const importantDayQueryKeys = {
  all: ['important-days'] as const,
  user: (userId: string) => [...importantDayQueryKeys.all, userId] as const,
  list: (userId: string) => [...importantDayQueryKeys.user(userId), 'list'] as const,
  festivals: (userId: string) => [...importantDayQueryKeys.user(userId), 'festivals'] as const,
}

async function messageFromResponse(response: { text: () => Promise<string> }): Promise<string> {
  const text = await response.text()
  if (!text) return '请求失败'
  try {
    const body = JSON.parse(text) as { message?: unknown }
    if (typeof body.message === 'string' && body.message.trim()) return body.message
  } catch {
    return text
  }
  return text
}

// ky 在非 2xx 时会读完响应体并放到 error.data，之后 response.text() 不能再读。
function messageFromKyData(error: unknown): string | undefined {
  if (!error || typeof error !== 'object' || !('data' in error)) return undefined
  const data = (error as { data?: unknown }).data
  if (typeof data === 'string' && data.trim()) return data
  if (!data || typeof data !== 'object' || !('message' in data)) return undefined
  const message = (data as { message?: unknown }).message
  return typeof message === 'string' && message.trim() ? message : undefined
}

async function parseResult<T>(request: Promise<unknown>): Promise<T> {
  try {
    const response = (await request) as {
      ok: boolean
      json: () => Promise<T>
      text: () => Promise<string>
    }
    if (!response.ok) throw new Error(await messageFromResponse(response))
    return await response.json()
  } catch (error) {
    const message = messageFromKyData(error)
    if (message) throw new Error(message)
    throw error
  }
}

export const importantDayListQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: importantDayQueryKeys.list(userId),
    queryFn: () => parseResult<ImportantDayResponse[]>(importantDayClient.api['important-day'].$get()),
  })

export const festivalOptionsQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: importantDayQueryKeys.festivals(userId),
    queryFn: () => parseResult<FestivalOption[]>(importantDayClient.api['important-day'].festivals.$get()),
  })

export const createImportantDay = (data: ImportantDayInput) =>
  parseResult<ImportantDayResponse>(importantDayClient.api['important-day'].$post({ json: data }))

export const updateImportantDay = (id: number, data: ImportantDayInput) =>
  parseResult<ImportantDayResponse>(
    importantDayClient.api['important-day'][':id'].$patch({
      param: { id },
      json: data,
    }),
  )

export const deleteImportantDay = (id: number) =>
  parseResult<ImportantDayResponse>(
    importantDayClient.api['important-day'][':id'].$delete({
      param: { id },
    }),
  )

export function useForgetImportantDaysWhenUserChanges(userId: string | null) {
  const queryClient = useQueryClient()
  const previousUserId = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    const previous = previousUserId.current
    if (previous && previous !== userId) {
      queryClient.removeQueries({ queryKey: importantDayQueryKeys.user(previous) })
    }
    previousUserId.current = userId
  }, [queryClient, userId])
}
