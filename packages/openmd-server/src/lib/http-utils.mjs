import { Buffer } from 'node:buffer'

export const sendJson = (response, status, data, extraHeaders = {}) => {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    ...extraHeaders,
  })
  response.end(JSON.stringify(data))
}

export const readJsonBody = async (request) => {
  const chunks = []

  for await (const chunk of request) {
    chunks.push(chunk)
  }

  const body = Buffer.concat(chunks).toString('utf8')

  if (!body) {
    return {}
  }

  return JSON.parse(body)
}

export const getRelativePath = (value = '') => {
  const cleanPath = String(value).replaceAll('\\', '/')

  if (cleanPath === '.' || cleanPath === '/') {
    return ''
  }

  return cleanPath.replace(/^\/+/, '')
}

export const applyCors = (request, response) => {
  const origin = request.headers.origin ?? '*'

  return {
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    'access-control-allow-headers': 'Content-Type, Authorization',
    'access-control-allow-credentials': 'true',
  }
}

export const handleCorsPreflight = (request, response) => {
  if (request.method === 'OPTIONS') {
    response.writeHead(204, applyCors(request, response))
    response.end()
    return true
  }

  return false
}
