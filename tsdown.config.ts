import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  format: 'esm',
  platform: 'node',
  target: 'node24',
  outDir: 'dist',
  clean: true,
  minify: true,
  deps: {
    alwaysBundle: ['@actions/core', 'axios', 'zod'],
    onlyBundle: false,
  },
})
