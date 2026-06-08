import { loader } from '@monaco-editor/react'

declare global {
  interface Window {
    monaco?: typeof import('monaco-editor')
  }
}

let monacoReady: Promise<void> | null = null

export const initMonaco = (): Promise<void> => {
  if (!monacoReady) {
    const monacoBase = `${import.meta.env.BASE_URL}monaco/vs`

    loader.config({ paths: { vs: monacoBase } })

    monacoReady = loader.init().then((monaco) => {
      window.monaco = monaco
    })
  }

  return monacoReady
}
