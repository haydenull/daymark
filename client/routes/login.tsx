import { createFileRoute, useNavigate } from '@tanstack/react-router'
import type { FormEvent } from 'react'
import { useState } from 'react'

import { authClient, authErrorMessage } from '@/client/libs/auth-client'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

const inputClass = 'mt-1 w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700'

type FieldErrors = {
  email?: string
  password?: string
}

function validate(email: string, password: string): FieldErrors {
  const errors: FieldErrors = {}
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = '请输入有效的邮箱'
  if (password.length < 8) errors.password = '密码至少 8 位'
  if (password.length > 128) errors.password = '密码不能超过 128 位'
  return errors
}

function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextEmail = email.trim()
    const errors = validate(nextEmail, password)
    setFieldErrors(errors)
    setFormError(null)
    if (errors.email || errors.password) return

    setPending(true)
    try {
      const result = await authClient.signIn.email({ email: nextEmail, password })
      if (result.error || !result.data) {
        setFormError(authErrorMessage(result.error, '登录失败'))
        return
      }
      await navigate({ to: '/' })
    } catch (error) {
      setFormError(authErrorMessage(error, '网络异常，请稍后重试'))
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="mx-auto max-w-md px-6 py-16">
      <h1 className="text-3xl font-semibold tracking-tight">登录</h1>
      <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-4">
        <label className="block text-sm">
          邮箱
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={inputClass}
          />
        </label>
        {fieldErrors.email ? <p className="text-sm text-red-600">{fieldErrors.email}</p> : null}
        <label className="block text-sm">
          密码
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={inputClass}
          />
        </label>
        {fieldErrors.password ? <p className="text-sm text-red-600">{fieldErrors.password}</p> : null}
        {formError ? <p className="text-sm text-red-600">{formError}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-zinc-900 px-4 py-2 text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {pending ? '登录中...' : '登录'}
        </button>
      </form>
    </main>
  )
}
