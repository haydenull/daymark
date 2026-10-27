import { existingAccount } from '../e2e/helpers/registration-disabled-account'
import { auth } from '../server/auth'
import { sqlite } from '../server/db'

const result = await auth.api.signUpEmail({
  body: {
    name: existingAccount.name,
    email: existingAccount.email,
    password: existingAccount.password,
  },
})

if (!result.user) {
  throw new Error(`预置账号失败：${JSON.stringify(result)}`)
}

sqlite.close()
console.error(`E2E prepared account: ${existingAccount.email}`)
