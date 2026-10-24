import type { Context, MiddlewareHandler } from 'hono'
import { HTTPException } from 'hono/http-exception'

import { auth } from '@/server/auth'

export type AuthUser = {
  id: string
  name: string
  email: string
}

type AuthContext = {
  Variables: {
    user: AuthUser
    session: NonNullable<Awaited<ReturnType<typeof auth.api.getSession>>>['session']
  }
}

export const requireAuth: MiddlewareHandler<AuthContext> = async (c, next) => {
  const result = await auth.api.getSession({ headers: c.req.raw.headers })
  if (!result) {
    throw new HTTPException(401, { message: '未登录' })
  }

  c.set('user', {
    id: result.user.id,
    name: result.user.name,
    email: result.user.email,
  })
  c.set('session', result.session)
  await next()
}

export function currentUser(c: Context<{ Variables: { user: AuthUser } }>): AuthUser {
  const user = c.get('user')
  if (!user) {
    throw new HTTPException(401, { message: '未登录' })
  }
  return user
}
