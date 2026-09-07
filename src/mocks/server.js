import { setupServer } from 'msw/node'

import { accountHandlers } from './account-api/handlers.js'

let mockServer

// Starts the in-process MSW server that intercepts the Account API calls.
// Idempotent: the server is a process singleton, so repeated calls (e.g. once
// per test that builds a server) are safe.
export async function startMockApi() {
  if (mockServer) {
    return mockServer
  }

  mockServer = setupServer(...accountHandlers())
  mockServer.listen({ onUnhandledRequest: 'warn' })
  return mockServer
}

export function getMockServer() {
  return mockServer
}
