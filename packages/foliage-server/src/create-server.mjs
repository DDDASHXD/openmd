import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import process from 'node:process'
import path from 'node:path'
import { WebSocketServer } from 'ws'

import { getArgumentValue, hasFlag } from './lib/args.mjs'
import { createBibHandlers } from './lib/bib.mjs'
import {
  applyCors,
  getRelativePath,
  handleCorsPreflight,
  readJsonBody,
  sendJson,
} from './lib/http-utils.mjs'
import { createProjectScaffold } from './lib/project-template.mjs'
import { createRelayClient } from './lib/relay-client.mjs'
import { createSettingsHandlers } from './lib/settings.mjs'
import { createWorkspaceApi } from './lib/workspace.mjs'

const packageRoot = fileURLToPath(new URL('..', import.meta.url))
const require = createRequire(import.meta.url)
const { getYDoc, setupWSConnection } = require('y-websocket/bin/utils')

const { runLeafmarkExport } = await import('../lib/leafmark-export.mjs')
const { handleLeafmarkRequest } = await import('../lib/leafmark-server.mjs')

export const startServer = async (options = {}) => {
  const argv = options.argv ?? process.argv
  const requestedPort = getArgumentValue(argv, '--port')
  const hostname =
    options.hostname ?? getArgumentValue(argv, '--hostname') ?? process.env.HOSTNAME ?? '0.0.0.0'
  const port =
    options.port ??
    (requestedPort ? Number.parseInt(requestedPort, 10) : undefined) ??
    Number.parseInt(process.env.PORT ?? '3000', 10)

  let headless = options.headless

  if (headless === undefined && hasFlag(argv, '--headless')) {
    headless = true
  }

  if (headless === undefined) {
    headless = true
  }

  const requestedWorkspace = getArgumentValue(argv, '--workspace')
  let workspaceRoot = path.resolve(options.workspaceRoot ?? requestedWorkspace ?? process.cwd())
  let workspaceName = path.basename(workspaceRoot) || workspaceRoot

  process.env.FOLIAGE_WORKSPACE = workspaceRoot

  let workspace = createWorkspaceApi(workspaceRoot)
  let settings = createSettingsHandlers(workspaceRoot)
  let bib = createBibHandlers(workspace.resolveWorkspacePath)

  let relayClient = createRelayClient({ relayUrl: '', sessionId: '', localPort: port })

  const setWorkspaceRoot = (nextWorkspacePath) => {
    workspaceRoot = path.resolve(nextWorkspacePath)
    workspaceName = path.basename(workspaceRoot) || workspaceRoot
    process.env.FOLIAGE_WORKSPACE = workspaceRoot
    workspace = createWorkspaceApi(workspaceRoot)
    settings = createSettingsHandlers(workspaceRoot)
    bib = createBibHandlers(workspace.resolveWorkspacePath)
  }

  const corsHeaders = (request) => applyCors(request)

  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '', `http://${request.headers.host}`)

    if (handleCorsPreflight(request, response)) {
      return
    }

    if (url.pathname === '/api/health' && request.method === 'GET') {
      sendJson(
        response,
        200,
        {
          ok: true,
          workspace: workspaceName,
          workspacePath: workspaceRoot,
          mode: 'headless',
        },
        corsHeaders(request),
      )
      return
    }

    if (url.pathname === '/api/live-share/status' && request.method === 'GET') {
      sendJson(response, 200, relayClient.getStatus(), corsHeaders(request))
      return
    }

    if (url.pathname === '/api/live-share/start' && request.method === 'POST') {
      void readJsonBody(request)
        .then(async (body) => {
          const relayUrl = body.relayUrl
          const sessionId = body.sessionId

          if (!relayUrl || typeof relayUrl !== 'string') {
            throw new Error('Relay URL is required.')
          }

          if (!sessionId || typeof sessionId !== 'string') {
            throw new Error('Session ID is required.')
          }

          relayClient.stop()
          relayClient = createRelayClient({
            relayUrl,
            sessionId,
            localPort: port,
          })

          await relayClient.start()

          return relayClient.getStatus()
        })
        .then((status) => {
          sendJson(response, 200, { status }, corsHeaders(request))
        })
        .catch((error) => {
          sendJson(
            response,
            400,
            { error: error instanceof Error ? error.message : 'Unable to start live share.' },
            corsHeaders(request),
          )
        })

      return
    }

    if (url.pathname === '/api/live-share/stop' && request.method === 'POST') {
      relayClient.stop()
      sendJson(response, 200, { status: relayClient.getStatus() }, corsHeaders(request))
      return
    }

    if (url.pathname === '/api/workspace/session' && request.method === 'PATCH') {
      void readJsonBody(request)
        .then((body) => {
          const nextWorkspacePath = body.workspacePath

          if (!nextWorkspacePath || typeof nextWorkspacePath !== 'string') {
            throw new Error('Workspace path is required.')
          }

          setWorkspaceRoot(nextWorkspacePath)

          return {
            workspace: workspaceName,
            workspacePath: workspaceRoot,
          }
        })
        .then((session) => {
          sendJson(response, 200, { session }, corsHeaders(request))
        })
        .catch((error) => {
          sendJson(
            response,
            400,
            { error: error instanceof Error ? error.message : 'Unable to switch workspace.' },
            corsHeaders(request),
          )
        })

      return
    }

    if (url.pathname === '/api/workspace/project' && request.method === 'POST') {
      void readJsonBody(request)
        .then(async (body) => {
          const targetPath = body.path

          if (!targetPath || typeof targetPath !== 'string') {
            throw new Error('Project path is required.')
          }

          return createProjectScaffold(targetPath)
        })
        .then((project) => {
          sendJson(response, 201, { project }, corsHeaders(request))
        })
        .catch((error) => {
          sendJson(
            response,
            400,
            { error: error instanceof Error ? error.message : 'Unable to create project.' },
            corsHeaders(request),
          )
        })

      return
    }

    if (url.pathname === '/api/workspace' && request.method === 'GET') {
      const relativePath = getRelativePath(url.searchParams.get('path') ?? '')

      void workspace
        .getDirectoryEntries(relativePath)
        .then((entries) => {
          sendJson(
            response,
            200,
            {
              root: {
                name: workspaceName,
                path: '',
              },
              entries,
            },
            corsHeaders(request),
          )
        })
        .catch((error) => {
          sendJson(
            response,
            400,
            { error: error instanceof Error ? error.message : 'Invalid path.' },
            corsHeaders(request),
          )
        })

      return
    }

    if (url.pathname === '/api/workspace' && request.method === 'POST') {
      void readJsonBody(request)
        .then((body) => workspace.createWorkspaceEntry(body))
        .then((entry) => {
          sendJson(response, 201, { entry }, corsHeaders(request))
        })
        .catch((error) => {
          sendJson(
            response,
            400,
            { error: error instanceof Error ? error.message : 'Unable to create entry.' },
            corsHeaders(request),
          )
        })

      return
    }

    if (url.pathname === '/api/workspace' && request.method === 'DELETE') {
      void readJsonBody(request)
        .then((body) => workspace.deleteWorkspaceEntry(body))
        .then((entry) => {
          sendJson(response, 200, { entry }, corsHeaders(request))
        })
        .catch((error) => {
          sendJson(
            response,
            400,
            { error: error instanceof Error ? error.message : 'Unable to delete entry.' },
            corsHeaders(request),
          )
        })

      return
    }

    if (url.pathname === '/api/workspace' && request.method === 'PATCH') {
      void readJsonBody(request)
        .then((body) => workspace.moveWorkspaceEntry(body))
        .then((result) => {
          sendJson(response, 200, result, corsHeaders(request))
        })
        .catch((error) => {
          sendJson(
            response,
            400,
            { error: error instanceof Error ? error.message : 'Unable to move entry.' },
            corsHeaders(request),
          )
        })

      return
    }

    if (url.pathname === '/api/workspace' && request.method === 'PUT') {
      void workspace
        .uploadWorkspaceFile(request)
        .then((result) => {
          sendJson(response, 200, { success: true, path: result.path }, corsHeaders(request))
        })
        .catch((error) => {
          sendJson(
            response,
            400,
            { error: error instanceof Error ? error.message : 'Unable to upload file.' },
            corsHeaders(request),
          )
        })

      return
    }

    if (url.pathname === '/api/workspace/settings') {
      if (request.method === 'GET') {
        void settings
          .ensureFoliageFolder()
          .then(() => settings.loadSettings())
          .then((loaded) => {
            sendJson(response, 200, { settings: loaded }, corsHeaders(request))
          })
          .catch((error) => {
            sendJson(
              response,
              400,
              { error: error instanceof Error ? error.message : 'Unable to load settings.' },
              corsHeaders(request),
            )
          })

        return
      }

      if (request.method === 'POST') {
        void readJsonBody(request)
          .then((body) => settings.saveSettings(body))
          .then((saved) => {
            sendJson(response, 200, { settings: saved }, corsHeaders(request))
          })
          .catch((error) => {
            sendJson(
              response,
              400,
              { error: error instanceof Error ? error.message : 'Unable to save settings.' },
              corsHeaders(request),
            )
          })

        return
      }

      sendJson(response, 405, { error: 'Method not allowed.' }, corsHeaders(request))
      return
    }

    if (url.pathname === '/api/workspace/bib' && request.method === 'GET') {
      void bib
        .getBibEntries()
        .then((entries) => {
          sendJson(response, 200, { entries }, corsHeaders(request))
        })
        .catch((error) => {
          sendJson(
            response,
            500,
            { error: error instanceof Error ? error.message : 'Failed to parse bib files.' },
            corsHeaders(request),
          )
        })

      return
    }

    if (url.pathname === '/api/workspace/leafmark') {
      const query = Object.fromEntries(url.searchParams.entries())

      if (request.method === 'GET') {
        void handleLeafmarkRequest(workspaceRoot, 'GET', {}, query)
          .then((result) => sendJson(response, 200, result, corsHeaders(request)))
          .catch((error) => {
            sendJson(
              response,
              400,
              { error: error instanceof Error ? error.message : 'Leafmark request failed.' },
              corsHeaders(request),
            )
          })

        return
      }

      if (request.method === 'POST') {
        void readJsonBody(request)
          .then((payload) => handleLeafmarkRequest(workspaceRoot, 'POST', payload, {}))
          .then((result) => sendJson(response, 200, result, corsHeaders(request)))
          .catch((error) => {
            sendJson(
              response,
              400,
              { error: error instanceof Error ? error.message : 'Leafmark request failed.' },
              corsHeaders(request),
            )
          })

        return
      }

      sendJson(response, 405, { error: 'Method not allowed.' }, corsHeaders(request))
      return
    }

    if (url.pathname === '/api/workspace/export' && request.method === 'POST') {
      void readJsonBody(request)
        .then((body) => runLeafmarkExport(workspaceRoot, body.folder ?? '', body.options ?? {}))
        .then((result) => {
          sendJson(response, 200, result, corsHeaders(request))
        })
        .catch((error) => {
          sendJson(
            response,
            400,
            { error: error instanceof Error ? error.message : 'Unable to export markdown.' },
            corsHeaders(request),
          )
        })

      return
    }

    if (url.pathname === '/api/workspace/file' && request.method === 'GET') {
      const relativePath = getRelativePath(url.searchParams.get('path') ?? '')
      void workspace.serveWorkspaceFile(relativePath, response, (res, status, data) =>
        sendJson(res, status, data, corsHeaders(request)),
      )
      return
    }

    if (url.pathname === '/api/workspace') {
      sendJson(response, 405, { error: 'Method not allowed.' }, corsHeaders(request))
      return
    }

    if (url.pathname === '/') {
      sendJson(
        response,
        200,
        {
          name: 'foliage-server',
          mode: 'headless',
          workspace: workspaceName,
        },
        corsHeaders(request),
      )
      return
    }

    sendJson(response, 404, { error: 'Not found.' }, corsHeaders(request))
  })

  const collaborationServer = new WebSocketServer({ noServer: true })

  const initializeCollaborationDoc = async (docName) => {
    const doc = getYDoc(docName)
    const metadata = doc.getMap('metadata')

    if (metadata.get('initialized') === true) {
      return
    }

    const yText = doc.getText('monaco')
    const fileText = await workspace.readTextFile(docName).catch(() => '')

    if (yText.length === 0) {
      yText.insert(0, fileText)
    }

    yText.observe(() => {
      workspace.scheduleDocSave(docName, yText)
    })

    metadata.set('initialized', true)
  }

  collaborationServer.on('connection', (socket, request) => {
    const url = new URL(request.url ?? '', `http://${request.headers.host}`)
    const docName = decodeURIComponent(url.pathname.replace(/^\/collaboration\/?/, ''))

    void initializeCollaborationDoc(docName)
      .then(() => {
        setupWSConnection(socket, request, { docName })
      })
      .catch(() => {
        socket.close()
      })
  })

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url ?? '', `http://${request.headers.host}`)

    if (url.pathname === '/collaboration' || url.pathname.startsWith('/collaboration/')) {
      collaborationServer.handleUpgrade(request, socket, head, (webSocket) => {
        collaborationServer.emit('connection', webSocket, request)
      })

      return
    }

    socket.destroy()
  })

  const shutdown = () => {
    relayClient.stop()
    server.close(() => process.exit(0))
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  await new Promise((resolve) => {
    server.listen(port, hostname, () => {
      console.log(`Foliage workspace: ${workspaceRoot}`)
      console.log(`Mode: headless`)
      console.log(`Ready on http://${hostname}:${port}`)
      resolve()
    })
  })

  return {
    server,
    port,
    hostname,
    workspaceRoot,
    headless: true,
    shutdown: () =>
      new Promise((resolve) => {
        relayClient.stop()
        server.close(() => resolve())
      }),
  }
}
