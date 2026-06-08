import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const rootDirectory = path.dirname(fileURLToPath(import.meta.url))
const appVersion = fs
  .readFileSync(path.resolve(rootDirectory, '../../VERSION'), 'utf8')
  .trim()

export default defineConfig({
  define: {
    'import.meta.env.VITE_FOLIAGE_VERSION': JSON.stringify(appVersion),
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(rootDirectory, './src'),
      '@workspace/ui': path.resolve(rootDirectory, '../../packages/ui/src'),
      '@workspace/ui/styles': path.resolve(rootDirectory, '../../packages/ui/src/styles'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: true,
      },
      '/collaboration': {
        target: 'ws://127.0.0.1:8787',
        ws: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  envPrefix: 'VITE_',
})
