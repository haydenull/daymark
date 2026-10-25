import { defaultExclude, defineConfig } from 'vitest/config'

import viteConfig from './vite.config.ts'

export default defineConfig({
  ...viteConfig,
  test: {
    exclude: [...defaultExclude, 'e2e/**'],
  },
})
