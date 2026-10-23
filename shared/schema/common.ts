import { z } from '@hono/zod-openapi'

export const errorSchema = z.object({
  code: z.number().openapi({ example: 400 }),
  message: z.string().openapi({ example: '请求参数错误' }),
})

/** 递归地将所有 Date 类型转换为 string 类型 */
export type DateToString<T> = {
  [K in keyof T]: T[K] extends Date
    ? string
    : T[K] extends Array<infer U>
      ? Array<DateToString<U>>
      : T[K] extends object
        ? DateToString<T[K]>
        : T[K]
}
