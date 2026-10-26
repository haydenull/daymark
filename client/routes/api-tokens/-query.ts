import { queryOptions, useQueryClient } from '@tanstack/react-query'
import { hc } from 'hono/client'
import { useEffect, useRef } from 'react'

import request from '@/client/libs/request'
import type { TokenAPI } from '@/server/api/token'
import type { ApiTokenResponse, CreateApiTokenInput, CreatedApiTokenResponse } from '@/shared/schema/api-token'

const tokenClient = hc<TokenAPI>(import.meta.env.BASE_URL, { fetch: request })

export const apiTokenQueryKeys = {
  all: ['api-tokens'] as const,
  user: (userId: string) => [...apiTokenQueryKeys.all, userId] as const,
  list: (userId: string) => [...apiTokenQueryKeys.user(userId), 'list'] as const,
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

export const apiTokenListQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: apiTokenQueryKeys.list(userId),
    queryFn: () => parseResult<ApiTokenResponse[]>(tokenClient.api.token.$get()),
  })

export const createApiToken = (data: CreateApiTokenInput) =>
  parseResult<CreatedApiTokenResponse>(tokenClient.api.token.$post({ json: data }))

export const revokeApiToken = (id: string) =>
  parseResult<ApiTokenResponse>(
    tokenClient.api.token[':id'].$delete({
      param: { id },
    }),
  )

export function useForgetApiTokensWhenUserChanges(userId: string | null) {
  const queryClient = useQueryClient()
  const previousUserId = useRef<string | null | undefined>(undefined)

  useEffect(() => {
    const previous = previousUserId.current
    if (previous && previous !== userId) {
      queryClient.removeQueries({ queryKey: apiTokenQueryKeys.user(previous) })
    }
    previousUserId.current = userId
  }, [queryClient, userId])
}
