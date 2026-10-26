import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import type { FormEvent, ReactNode } from 'react'
import { useState } from 'react'

import { authClient } from '@/client/libs/auth-client'
import type { ApiTokenResponse, CreatedApiTokenResponse } from '@/shared/schema/api-token'

import { apiTokenListQueryOptions, apiTokenQueryKeys, createApiToken, revokeApiToken } from './-query'

export const Route = createFileRoute('/api-tokens/')({
  component: ApiTokensPage,
})

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : '请求失败'
}

function PageMain({ children }: { children: ReactNode }) {
  return <main className="mx-auto max-w-3xl px-6 py-10">{children}</main>
}

function expiryLabel(expiresAt: string | null): string {
  if (!expiresAt) return '永不过期'
  const expires = new Date(expiresAt)
  const dateText = expires.toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' })
  if (expires.getTime() <= Date.now()) return `已于 ${dateText} 过期`
  return `有效期至 ${dateText}`
}

function ApiTokensPage() {
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
        <h1 className="text-3xl font-semibold tracking-tight">API Token</h1>
        <p className="mt-4 text-zinc-600 dark:text-zinc-300">登录后才能管理个人 API Token。</p>
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

  return <ApiTokenManager key={session.data.user.id} userId={session.data.user.id} />
}

function ApiTokenManager({ userId }: { userId: string }) {
  const queryClient = useQueryClient()
  const list = useQuery(apiTokenListQueryOptions(userId))
  const [name, setName] = useState('')
  const [neverExpires, setNeverExpires] = useState(false)
  const [nameError, setNameError] = useState<string | null>(null)
  const [created, setCreated] = useState<CreatedApiTokenResponse | null>(null)
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState<string | null>(null)

  const invalidate = () => queryClient.invalidateQueries({ queryKey: apiTokenQueryKeys.list(userId) })

  const create = useMutation({
    mutationFn: createApiToken,
    onSuccess: (token) => {
      setName('')
      setNeverExpires(false)
      setNameError(null)
      setCreated(token)
      setCopied(false)
      setCopyError(null)
      invalidate()
    },
  })
  const revoke = useMutation({
    mutationFn: revokeApiToken,
    onSuccess: (_data, id) => {
      if (created?.id === id) {
        setCreated(null)
        setCopied(false)
        setCopyError(null)
      }
      invalidate()
    },
  })

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextName = name.trim()
    if (!nextName) {
      setNameError('请输入名称')
      return
    }
    if (nextName.length > 50) {
      setNameError('名称不能超过 50 个字符')
      return
    }
    setNameError(null)
    create.mutate({ name: nextName, neverExpires })
  }

  async function handleCopy() {
    if (!created) return
    setCopyError(null)
    try {
      await navigator.clipboard.writeText(created.token)
      setCopied(true)
    } catch {
      setCopyError('复制失败，请手动复制')
    }
  }

  return (
    <PageMain>
      <h1 className="text-3xl font-semibold tracking-tight">API Token</h1>
      <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">
        用于脚本访问自己的数据。完整令牌只在创建时显示一次，之后只保存哈希。
      </p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
        <label className="block text-sm">
          名称
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
          />
        </label>
        {nameError ? <p className="text-sm text-red-600">{nameError}</p> : null}
        <fieldset className="space-y-2">
          <legend className="text-sm">有效期</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="expiry" checked={!neverExpires} onChange={() => setNeverExpires(false)} />
            90 天
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="radio" name="expiry" checked={neverExpires} onChange={() => setNeverExpires(true)} />
            永不过期
          </label>
        </fieldset>
        {create.isError ? <p className="text-sm text-red-600">{errorMessage(create.error)}</p> : null}
        <button
          type="submit"
          disabled={create.isPending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {create.isPending ? '创建中...' : '创建'}
        </button>
      </form>
      {created ? (
        <section className="mt-8 rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">完整令牌只显示一次，请立即复制保存。</p>
          <label className="mt-3 block text-sm">
            令牌
            <input
              readOnly
              value={created.token}
              className="mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 font-mono text-sm dark:border-zinc-700"
            />
          </label>
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              className="rounded border border-zinc-300 px-3 py-1 text-sm dark:border-zinc-700"
              onClick={() => void handleCopy()}
            >
              {copied ? '已复制' : '复制'}
            </button>
            {copyError ? <span className="text-sm text-red-600">{copyError}</span> : null}
          </div>
        </section>
      ) : null}
      {revoke.isError ? <p className="mt-4 text-sm text-red-600">{errorMessage(revoke.error)}</p> : null}
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
          <p className="text-zinc-500">还没有 API Token</p>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {list.data.map((item) => (
              <TokenRow key={item.id} item={item} pending={revoke.isPending} onRevoke={() => revoke.mutate(item.id)} />
            ))}
          </ul>
        )}
      </div>
    </PageMain>
  )
}

function TokenRow({ item, pending, onRevoke }: { item: ApiTokenResponse; pending: boolean; onRevoke: () => void }) {
  return (
    <li className="flex items-start gap-3 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium">{item.name}</span>
          <span className="font-mono text-sm text-zinc-500">{item.tokenPrefix}</span>
        </div>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">{expiryLabel(item.expiresAt)}</p>
      </div>
      <button
        type="button"
        className="text-sm text-zinc-500 hover:text-red-600 disabled:opacity-50"
        disabled={pending}
        onClick={onRevoke}
      >
        撤销
      </button>
    </li>
  )
}
