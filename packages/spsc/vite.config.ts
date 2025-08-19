import { defineConfig } from 'vitest/config'
import dts from 'vite-plugin-dts'
import path from 'node:path'
import { writeFileSync } from 'node:fs'
import { sharedConfig } from '../../vite.config.shared'

const myModules = ['common', 'reader', 'writer']

export default defineConfig({
  ...sharedConfig,
  plugins: [
    dts({
      afterBuild() {
        myModules.forEach(name => {
          writeFileSync(
            `dist/${name}.d.cts`, `export type * from './${name}.d.ts'\n`, 'utf-8')
        })
      },
    }),
  ],
  build: {
    ...sharedConfig.build,
    lib: {
      entry: Object.fromEntries(myModules.map((mod) =>
        [mod, path.resolve(import.meta.dirname, `src/${mod}.ts`)])),
    },
    rollupOptions: {
      preserveEntrySignatures: 'allow-extension',
    },
    minify: false,
  },
})
