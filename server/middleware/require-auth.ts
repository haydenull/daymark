import type { Context, MiddlewareHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'

import { findUserByApiToken } from '@/server/api-token'
import { auth, authBaseURL } from '@/server/auth'

export type AuthUser = {
  id: string
  name: string
  email: string
}

export type AuthEnv = {
  Variables: {
    user: AuthUser
    authMethod: 'session' | 'token'
  }
}

export const cookieOrBearerSecurity: Array<Record<string, string[]>> = [{ Bearer: [] }, { CookieAuth: [] }]
export const cookieAuthSecurity: Array<Record<string, string[]>> = [{ CookieAuth: [] }]

export const requireAuth: MiddlewareHandler<AuthEnv> = async (c, next) => {
  if (c.req.raw.headers.has('authorization')) {
    const user = findUserByApiToken(c.req.header('authorization') ?? '')
    if (!user) {
      throw new HTTPException(401, { message: '未登录' })
    }
    c.set('user', user)
    c.set('authMethod', 'token')
    await next()
    return
  }

  const result = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!result) {
    throw new HTTPException(401, { message: '未登录' })
  }

  c.set('user', {
    id: result.user.id,
    name: result.user.name,
    email: result.user.email,
  })
  c.set('authMethod', 'session')
  await next()
}

export const requireSession: MiddlewareHandler<AuthEnv> = async (c, next) => {
  await requireAuth(c, async () => {
    if (c.get('authMethod') !== 'session') {
      throw new HTTPException(401, { message: '未登录' })
    }
    await next()
  })
}

export function currentUser(c: Context<AuthEnv>): AuthUser {
  const user = c.get('user')
  if (!user) {
    throw new HTTPException(401, { message: '未登录' })
  }
  return user
}

export function assertTrustedOrigin(c: Context): void {
  const origin = requestOrigin(c)
  if (!origin || origin !== authBaseURL) {
    throw new HTTPException(403, { message: '请求来源不被允许' })
  }
}

function requestOrigin(c: Context): string | null {
  const origin = c.req.header('origin')
  if (origin) return origin

  const referer = c.req.header('referer')
  if (!referer) return null

  try {
    return new URL(referer).origin
  } catch {
    return null
  }
}
