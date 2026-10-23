import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">Bun Fullstack Template</h1>
      <p className="mt-4 text-zinc-600 dark:text-zinc-300">
        一个使用 Bun、Hono、Drizzle 和 React 的全栈 TypeScript 模板。前后端通过 Zod schema 与 Hono RPC 共享类型。
      </p>
      <Link
        to="/todo"
        className="mt-8 inline-block rounded-md bg-zinc-900 px-4 py-2 text-white dark:bg-zinc-100 dark:text-zinc-900"
      >
        打开 Todo 示例
      </Link>
    </main>
  )
}
