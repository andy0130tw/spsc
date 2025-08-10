import { sveltekit } from '@sveltejs/kit/vite'
import { defineConfig } from 'vitest/config'

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
  server: {
    port: 8099,
  },
  clearScreen: false,
  plugins: [
    configureResponseHeaders(),
    sveltekit(),
  ],
  worker: {
    format: 'es',
  },
  build: {
    // bumped for TLA
    target: ['es2022', 'edge89', 'firefox89', 'chrome89', 'safari15'],
  },
  test: {
    globals: true,
    include: ['src/**/*.{test,spec}.{js,ts}'],
  },
})
