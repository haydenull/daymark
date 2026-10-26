import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Link, Outlet } from '@tanstack/react-router'
import { lazy, Suspense, useState } from 'react'

import type { Theme } from '@/client/components/theme-provider'
import { useTheme } from '@/client/components/theme-provider'
import { authClient, authErrorMessage } from '@/client/libs/auth-client'
import { useForgetApiTokensWhenUserChanges } from '@/client/routes/api-tokens/-query'
import { useForgetImportantDaysWhenUserChanges } from '@/client/routes/important-days/-query'

const TanStackRouterDevtools = import.meta.env.PROD
  ? () => null
  : lazy(() =>
      import('@tanstack/react-router-devtools').then((mod) => ({
        default: mod.TanStackRouterDevtools,
      })),
    )

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootComponent,
})

const nextTheme: Record<Theme, Theme> = {
  light: 'dark',
  dark: 'system',
  system: 'light',
}

function AccountNav() {
  const session = authClient.useSession()
  const userId = session.data?.user.id ?? null
  useForgetImportantDaysWhenUserChanges(userId)
  useForgetApiTokensWhenUserChanges(userId)
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState<string | null>(null)

  async function handleSignOut() {
    setSigningOut(true)
    setSignOutError(null)
    try {
      const result = await authClient.signOut()
      if (result.error) setSignOutError(authErrorMessage(result.error, '退出失败'))
    } catch (error) {
      setSignOutError(authErrorMessage(error, '网络异常，请稍后重试'))
    } finally {
      setSigningOut(false)
    }
  }

  if (session.isPending) {
    return (
      <span className="text-sm text-zinc-500" aria-live="polite">
        会话加载中
      </span>
    )
  }

  if (session.error) {
    return (
      <button type="button" className="text-sm text-red-600" onClick={() => void session.refetch()}>
        会话加载失败，重试
      </button>
    )
  }

  if (session.data) {
    return (
      <div className="flex items-center gap-3">
        <span className="max-w-40 truncate text-sm">{session.data.user.name}</span>
        <button
          type="button"
          disabled={signingOut}
          className="rounded border border-zinc-300 px-2 py-1 text-sm disabled:opacity-50 dark:border-zinc-700"
          onClick={() => void handleSignOut()}
        >
          {signingOut ? '退出中...' : '退出'}
        </button>
        {signOutError ? <span className="text-sm text-red-600">{signOutError}</span> : null}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-3">
      <Link to="/login" className="text-sm text-zinc-600 dark:text-zinc-300">
        登录
      </Link>
      <Link to="/register" className="text-sm text-zinc-600 dark:text-zinc-300">
        注册
      </Link>
    </div>
  )
}

function RootComponent() {
  const { theme, setTheme } = useTheme()

  return (
    <>
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <nav className="mx-auto flex max-w-5xl items-center gap-4 px-4 py-3">
          <Link to="/" className="text-sm text-zinc-600 dark:text-zinc-300">
            Home
          </Link>
          <Link to="/todo" className="text-sm text-zinc-600 dark:text-zinc-300">
            Todo
          </Link>
          <Link to="/important-days" className="text-sm text-zinc-600 dark:text-zinc-300">
            重要日子
          </Link>
          <Link to="/api-tokens" className="text-sm text-zinc-600 dark:text-zinc-300">
            API Token
          </Link>
          <a href="/api/doc" target="_blank" rel="noreferrer" className="text-sm text-zinc-600 dark:text-zinc-300">
            API 文档
          </a>
          <div className="ml-auto flex items-center gap-3">
            <AccountNav />
            <button
              type="button"
              className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700"
              onClick={() => setTheme(nextTheme[theme])}
            >
              主题：{theme}
            </button>
          </div>
        </nav>
      </header>
      <Outlet />
      <Suspense>
        <TanStackRouterDevtools />
      </Suspense>
    </>
  )
}
