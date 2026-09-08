import { http, HttpResponse } from 'msw'

import { config } from '#config/config.js'
import { getMockServer } from '#mocks/server.js'

// Override the account-user handler on the running mock server so a journey test
// can declare the signed-in user it needs.
export function respondWithAccountUser(user) {
  const base = String(config.get('accountApi.baseUrl')).replace(/\/+$/, '')
  getMockServer().use(
    http.get(`${base}/api/users/user-organisations`, () =>
      HttpResponse.json({ user })
    )
  )
}
