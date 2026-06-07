import { NextRequest, NextResponse } from 'next/server'
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

export async function GET(request: NextRequest) {
  try {
    const { handleLeafmarkRequest } = await import(
      /* webpackIgnore: true */
      '../../../../lib/leafmark-server.mjs'
    )

    const query = Object.fromEntries(request.nextUrl.searchParams.entries())
    const result = await handleLeafmarkRequest(getWorkspaceRoot(), 'GET', {}, query)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Leafmark request failed.' },
      { status: 400 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const { handleLeafmarkRequest } = await import(
      /* webpackIgnore: true */
      '../../../../lib/leafmark-server.mjs'
    )

    const payload = (await request.json()) as Record<string, unknown>
    const result = await handleLeafmarkRequest(getWorkspaceRoot(), 'POST', payload, {})
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Leafmark request failed.' },
      { status: 400 },
    )
  }
}
