import { createHash, randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'

import { db } from '@/server/db'
import { user } from '@/server/db/auth-schema'
import { apiTokens } from '@/server/db/schema'
import type { AuthUser } from '@/server/middleware/require-auth'

const TOKEN_PREFIX = 'dm_'
const TOKEN_BYTES = 32
const DISPLAY_PREFIX_LENGTH = 12
export const DEFAULT_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000

export function hashApiToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function createApiTokenValue(): { token: string; prefix: string; hash: string } {
  const token = `${TOKEN_PREFIX}${randomBytes(TOKEN_BYTES).toString('base64url')}`
  return {
    token,
    prefix: token.slice(0, DISPLAY_PREFIX_LENGTH),
    hash: hashApiToken(token),
  }
}

function readBearerToken(authorization: string): string | null {
  const match = /^Bearer[ \t]+(\S+)$/i.exec(authorization.trim())
  return match?.[1] ?? null
}

export function findUserByApiToken(authorization: string): AuthUser | null {
  const token = readBearerToken(authorization)
  if (!token) return null

  const row = db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      expiresAt: apiTokens.expiresAt,
      revokedAt: apiTokens.revokedAt,
    })
    .from(apiTokens)
    .innerJoin(user, eq(apiTokens.userId, user.id))
    .where(eq(apiTokens.tokenHash, hashApiToken(token)))
    .get()

  if (!row || row.revokedAt) return null
  if (row.expiresAt && row.expiresAt.getTime() <= Date.now()) return null

  return { id: row.id, name: row.name, email: row.email }
}
