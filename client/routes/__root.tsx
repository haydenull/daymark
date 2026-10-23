import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Link, Outlet } from '@tanstack/react-router'
import { lazy, Suspense } from 'react'

import type { Theme } from '@/client/components/theme-provider'
import { useTheme } from '@/client/components/theme-provider'

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
          <a href="/api/doc" target="_blank" rel="noreferrer" className="text-sm text-zinc-600 dark:text-zinc-300">
            API 文档
          </a>
          <button
            type="button"
            className="ml-auto rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700"
            onClick={() => setTheme(nextTheme[theme])}
          >
            主题：{theme}
          </button>
        </nav>
      </header>
      <Outlet />
      <Suspense>
        <TanStackRouterDevtools />
      </Suspense>
    </>
  )
}
