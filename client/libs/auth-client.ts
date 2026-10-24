import { createAuthClient } from 'better-auth/react'

// 请求发往当前站点的 /api/auth。开发时由 Vite 代理到 Hono，生产环境与页面同源。
export const authClient = createAuthClient({
  baseURL: typeof window === 'undefined' ? undefined : window.location.origin,
})

const messagesByCode: Record<string, string> = {
  INVALID_EMAIL: '邮箱格式不正确',
  INVALID_ORIGIN: '请求来源不被允许',
  INVALID_EMAIL_OR_PASSWORD: '邮箱或密码不正确',
  INVALID_PASSWORD: '密码不正确',
  PASSWORD_TOO_LONG: '密码不能超过 128 位',
  PASSWORD_TOO_SHORT: '密码至少 8 位',
  USER_ALREADY_EXISTS: '该邮箱已注册',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: '该邮箱已注册',
}

const messagesByText: Record<string, string> = {
  'Invalid email': '邮箱格式不正确',
  'Invalid email or password': '邮箱或密码不正确',
  'Invalid password': '密码不正确',
  'Password too long': '密码不能超过 128 位',
  'Password too short': '密码至少 8 位',
  'User already exists.': '该邮箱已注册',
  'User already exists. Use another email.': '该邮箱已注册',
}

function readAuthError(error: unknown): { code?: string; message?: string; status?: number } {
  if (!error || typeof error !== 'object') return {}
  const source = 'error' in error && error.error && typeof error.error === 'object' ? error.error : error
  if (!source || typeof source !== 'object') return {}

  const record = source as Record<string, unknown>
  return {
    code: typeof record.code === 'string' ? record.code : undefined,
    message: typeof record.message === 'string' ? record.message : undefined,
    status: typeof record.status === 'number' ? record.status : undefined,
  }
}

export function authErrorMessage(error: unknown, fallback: string): string {
  const { code, message, status } = readAuthError(error)
  if (code && messagesByCode[code]) return messagesByCode[code]
  if (message && messagesByText[message]) return messagesByText[message]
  if (status === undefined || status === 0 || status >= 500) return '网络异常，请稍后重试'
  return message || fallback
}
