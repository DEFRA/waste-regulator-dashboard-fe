import { vi } from 'vitest'

import { createServer } from '../server.js'
import { config } from '../../config/config.js'
import { statusCodes } from '../common/constants/status-codes.js'

vi.mock('../common/services/account.mock.js', () => ({
  mockAccountDetails: {
    firstName: 'Basil',
    lastName: 'Basic',
    contactEmail: 'basil.basic@example.test',
    serviceRoleId: 5,
    serviceRole: 'Regulator Basic',
    organisationName: 'Example Environment Agency',
    nationId: 1
  }
}))

describe('manage-account link visibility for a Regulator Basic user', () => {
  let server
  let originalUseMockAuth
  let originalUseMockApi
  let originalAzureBase

  beforeAll(async () => {
    originalUseMockAuth = config.get('useMockAuth')
    originalUseMockApi = config.get('useMockApi')
    originalAzureBase = config.get('services.regulatorAzure.baseUrl')
    config.set('useMockAuth', true)
    config.set('useMockApi', true)
    config.set('services.regulatorAzure.baseUrl', 'https://example.org')
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    config.set('useMockAuth', originalUseMockAuth)
    config.set('useMockApi', originalUseMockApi)
    config.set('services.regulatorAzure.baseUrl', originalAzureBase)
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

  test('renders the dashboard for a Regulator Basic user', async () => {
    const { statusCode, result } = await signInThenLoadDashboard()

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(
      expect.stringContaining(
        'href="https://example.org/regulators/applications"'
      )
    )
  })

  test('hides the manage-account link from a Regulator Basic user', async () => {
    const { result } = await signInThenLoadDashboard()

    expect(result).not.toEqual(
      expect.stringContaining('/regulators/manage-account/manage')
    )
  })
})
