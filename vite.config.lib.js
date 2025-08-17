import { defineConfig } from 'vitest/config'
import dts from 'vite-plugin-dts'
import path from 'node:path'
import { copyFileSync } from 'node:fs'
import { sharedConfig } from './vite.config.js'

export default defineConfig({
  ...sharedConfig,
  plugins: [
    dts({
      afterBuild() {
        ['common', 'reader', 'writer'].forEach(name => {
          copyFileSync(`src/lib/spsc/${name}.d.cts`, `dist/${name}.d.cts`)
        })
      },
    }),
  ],
  build: {
    ...sharedConfig.build,
    lib: {
      entry: {
        common: path.resolve(import.meta.dirname, 'src/lib/spsc/common.ts'),
        reader: path.resolve(import.meta.dirname, 'src/lib/spsc/reader.ts'),
        writer: path.resolve(import.meta.dirname, 'src/lib/spsc/writer.ts'),
      },
    },
    minify: false,
  },
})
