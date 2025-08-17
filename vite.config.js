import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vitest/config'
import { sharedConfig } from './vite.config.shared'

/** @returns {import('vite').Plugin<unknown>} */
function configureResponseHeaders() {
  return ({
    name: 'configure-response-headers',
    configureServer: server => {
      server.middlewares.use((_req, res, next) => {
        res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp')
        res.setHeader('Cross-Origin-Opener-Policy', 'same-origin')
        next()
      })
    },
  })
}

export default defineConfig({
  ...sharedConfig,
  server: {
    port: 8099,
    fs: {
      allow: ['packages']
    }
  },
  plugins: [
    configureResponseHeaders(),
    sveltekit(),
  ],
  worker: {
    format: 'es',
  },
})
