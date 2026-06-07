#!/usr/bin/env node

import { fileURLToPath } from 'node:url'
import path from 'node:path'

import { startServer } from '@openmd/server'

const appDirectory = fileURLToPath(new URL('../apps/web', import.meta.url))

await startServer({
  appDirectory,
  serveNext: true,
})
