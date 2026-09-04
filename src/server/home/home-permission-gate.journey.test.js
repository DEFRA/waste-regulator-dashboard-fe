import { vi } from 'vitest'

import { createServer } from '../server.js'
import { config } from '../../config/config.js'
import { statusCodes } from '../common/constants/status-codes.js'

vi.mock('../common/services/account.mock.js', () => ({
  mockAccountDetails: {
    firstName: 'Percy',
    lastName: 'Producer',
    contactEmail: 'percy.producer@example.test',
    serviceRoleId: 3,
    serviceRole: 'Basic User',
    organisationName: 'Example Producer Ltd',
    nationId: 1
  }
}))

describe('regulator permission gate on the dashboard', () => {
  let server
  let originalUseMockAuth
  let originalUseMockApi

  beforeAll(async () => {
    originalUseMockAuth = config.get('useMockAuth')
    originalUseMockApi = config.get('useMockApi')
    config.set('useMockAuth', true)
    config.set('useMockApi', true)
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    config.set('useMockAuth', originalUseMockAuth)
    config.set('useMockApi', originalUseMockApi)
    await server.stop({ timeout: 0 })
  })

  async function signInThenLoadDashboard() {
    const signinResponse = await server.inject({
      method: 'GET',
      url: '/signin-oidc'
    })
    const setCookie = signinResponse.headers['set-cookie'] ?? []
    const sessionCookie = []
      .concat(setCookie)
      .map((cookie) => cookie.split(';')[0])
      .join('; ')

    return server.inject({
      method: 'GET',
      url: '/',
      headers: { cookie: sessionCookie }
    })
  }

  test('denies dashboard access to a signed-in non-regulator', async () => {
    const { statusCode, result } = await signInThenLoadDashboard()

    expect(statusCode).toBe(statusCodes.forbidden)
    expect(result).toEqual(
      expect.stringContaining('You do not have permission to access this page')
    )
  })
})
