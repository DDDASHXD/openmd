import { NextResponse } from 'next/server'
import path from 'path'
import process from 'process'

export const runtime = 'nodejs'

const getWorkspaceRoot = () => {
  const serverWorkspace = process.env.OPENMD_WORKSPACE

  if (serverWorkspace) {
    return path.resolve(serverWorkspace)
  }

  return process.cwd()
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      folder?: string
      options?: Record<string, unknown>
    }

    const { runLeafmarkExport } = await import(
      /* webpackIgnore: true */
      '../../../../lib/leafmark-export.mjs'
    )

    const result = await runLeafmarkExport(
      getWorkspaceRoot(),
      body.folder ?? '',
      body.options ?? {},
    )

    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to export markdown.' },
      { status: 400 },
    )
  }
}
