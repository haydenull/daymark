import { betterAuth } from 'better-auth'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'

import { ENV } from '@/env'
import { db } from '@/server/db'
import * as authSchema from '@/server/db/auth-schema'

// 迁移和数据库连接只依赖 DB_FILE_NAME。账号配置在这里校验，避免没有密钥时连迁移都无法执行。
const insecureSecrets = new Set(['replace-with-openssl-rand-base64-32', 'better-auth-secret-123456789'])

function readAuthSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET?.trim()
  if (!secret || secret.length < 32 || insecureSecrets.has(secret)) {
    throw new Error('BETTER_AUTH_SECRET is required. Generate one with: openssl rand -base64 32')
  }
  return secret
}

function readAuthURL(): string {
  const value = process.env.BETTER_AUTH_URL?.trim()
  if (!value) {
    throw new Error('BETTER_AUTH_URL is required. Local development uses http://localhost:5173')
  }

  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('BETTER_AUTH_URL must be an absolute http(s) URL')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('BETTER_AUTH_URL must use http or https')
  }
  if (url.pathname !== '/' || url.search !== '' || url.hash !== '') {
    throw new Error('BETTER_AUTH_URL must be the site origin, for example http://localhost:5173')
  }
  return url.origin
}

export const authBaseURL = readAuthURL()

export const auth = betterAuth({
  baseURL: authBaseURL,
  secret: readAuthSecret(),
  trustedOrigins: [authBaseURL],
  database: drizzleAdapter(db, {
    provider: 'sqlite',
    schema: authSchema,
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: ENV.DISABLE_REGISTRATION,
    autoSignIn: true,
    requireEmailVerification: false,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    // 关闭 cookie 缓存后，退出和过期会在下一次读取会话时立即生效。
    cookieCache: {
      enabled: false,
    },
  },
})
