import { defineConfig } from 'vite'
import pkg from './package.json' with { type: 'json' }
import path from 'node:path'
import { fileURLToPath } from 'node:url'
const r = (p: string) => path.resolve(fileURLToPath(import.meta.url), '..', p)

export default defineConfig({
  // Serve the playground from /test
  root: 'test',
  server: { host: true, port: 8082 },
  preview: { host: true, port: 4173 },

  // Let test/test.js import 'coinrayjs' but resolve to local source for dev
  resolve: {
    alias: {
      coinrayjs: r('lib/index.ts'),
    },
  },

  // Build the library from /lib to /dist
  build: {
    // When root != project root, outDir is relative to root, so go up
    outDir: '../dist',
    emptyOutDir: true,
    sourcemap: true,
    lib: {
      entry: r('lib/index.ts'),
      name: 'Coinray',
      formats: ['es', 'iife'],
      fileName: (format) => (format === 'es' ? 'coinrayjs.es.js' : 'coinrayjs.js'),
    },
    rollupOptions: {
      // external: ['lodash', 'moment'] // (optional) keep deps external
      // output: { globals: { lodash: '_', moment: 'moment' } }
    },
  },

  // Inject package version as a constant you can export/use
  define: {
    __VERSION__: JSON.stringify(pkg.version),
  },
})
