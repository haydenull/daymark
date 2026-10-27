import { queryOptions } from '@tanstack/react-query'
import { hc } from 'hono/client'

import request from '@/client/libs/request'
import type { ConfigAPI } from '@/server/api/config'
import type { PublicConfig } from '@/shared/schema/config'

const configClient = hc<ConfigAPI>(import.meta.env.BASE_URL, { fetch: request })

export const publicConfigQueryKeys = {
  all: ['public-config'] as const,
}

export const publicConfigQueryOptions = () =>
  queryOptions({
    queryKey: publicConfigQueryKeys.all,
    queryFn: async (): Promise<PublicConfig> => {
      const response = await configClient.api.config.$get()
      if (!response.ok) throw new Error('配置加载失败')
      return response.json()
    },
  })
