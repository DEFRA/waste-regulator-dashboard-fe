// Account API backend mock: serves the signed-in user for the
// user-organisations lookup the dashboard makes on sign-in.

import { http, HttpResponse } from 'msw'

import { config } from '#config/config.js'
import { mockAccountUser } from './fixtures.js'

export function accountHandlers() {
  const base = String(config.get('accountApi.baseUrl')).replace(/\/+$/, '')

  return [
    http.get(`${base}/api/users/user-organisations`, () =>
      HttpResponse.json({ user: mockAccountUser })
    )
  ]
}
