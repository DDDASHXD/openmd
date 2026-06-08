import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
import '@workspace/ui/styles/globals.css'

import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

import { App } from '@/app'
import { cn } from '@workspace/ui/lib/utils'

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element not found.')
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <div className={cn('antialiased font-mono bg-secondary min-h-screen')}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </div>
  </React.StrictMode>,
)
