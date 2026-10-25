// 只给 E2E 服务器和测试共用。生产启动不会加载控制端口。
export const e2eClockPort = 3099
export const e2eClockOrigin = `http://127.0.0.1:${e2eClockPort}`
