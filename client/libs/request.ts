import ky from 'ky'

const request = ky.create({
  retry: 0,
  throwHttpErrors: true,
})

// Hono RPC 的 fetch 选项使用 fetch 的类型，ky 实例在运行时按 fetch(input, init) 调用。
export default request as unknown as typeof fetch
