// 只给禁用注册 E2E 的临时库使用。准备脚本和测试都读这份数据，避免测试进程执行准备脚本。
export const existingAccount = {
  email: 'e2e-existing@example.com',
  name: 'e2e-existing',
  password: 'daymark-e2e-password',
}
