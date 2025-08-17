import { defineConfig } from 'vitest/config'

export const sharedConfig = defineConfig({
  clearScreen: false,
  build: {
    // bumped for TLA
    target: ['es2022', 'edge89', 'firefox89', 'chrome89', 'safari15'],
  },
  test: {
    globals: true,
    include: ['src/**/*.{test,spec}.{js,ts}'],
  },
})
