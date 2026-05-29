import { vi } from 'vitest'

import { createServer } from '../server.js'
import { config } from '../../config/config.js'
import { statusCodes } from '../common/constants/status-codes.js'

const mockAccount = {
  firstName: 'John',
  lastName: 'Doe',
  contactEmail: 'john.doe@example.org',
  serviceRoleId: 4,
  serviceRole: 'Regulator Admin',
  organisationName: 'Example Environment Agency',
  nationId: 1
}

let originalAzureBase

beforeAll(() => {
  originalAzureBase = config.get('services.regulatorAzure.baseUrl')
  config.set('services.regulatorAzure.baseUrl', 'https://example.org')
})

afterAll(() => {
  config.set('services.regulatorAzure.baseUrl', originalAzureBase)
})

async function getHomeAsAuthenticatedUser(server) {
  const signinResponse = await server.inject({
    method: 'GET',
    url: '/regulators/signin-oidc'
  })
  const setCookie = signinResponse.headers['set-cookie'] ?? []
  const sessionCookie = []
    .concat(setCookie)
    .map((c) => c.split(';')[0])
    .join('; ')

  return server.inject({
    method: 'GET',
    url: '/',
    headers: { cookie: sessionCookie }
  })
}

function mockGatewayAccountFetch() {
  return vi.fn(async () => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    async json() {
      return mockAccount
    }
  }))
}

describe('#homeController', () => {
  describe('with default config', () => {
    let server
    let originalFetch

    beforeAll(async () => {
      server = await createServer()
      await server.initialize()
    })

    beforeEach(() => {
      originalFetch = globalThis.fetch
      const mockFetch = mockGatewayAccountFetch()
      globalThis.fetch = mockFetch
      global.fetch = mockFetch
    })

    afterEach(() => {
      globalThis.fetch = originalFetch
      global.fetch = originalFetch
    })

    afterAll(async () => {
      await server.stop({ timeout: 0 })
    })

    test('Should redirect to signin when no session user', async () => {
      const { statusCode, headers } = await server.inject({
        method: 'GET',
        url: '/'
      })

      expect(statusCode).toBe(statusCodes.found)
      expect(headers.location).toBe('/regulators/signin-oidc')
    })

    test('Should render dashboard when authenticated', async () => {
      const { result, statusCode } = await getHomeAsAuthenticatedUser(server)

      expect(result).toEqual(expect.stringContaining('Regulator Dashboard'))
      expect(result).toEqual(
        expect.stringContaining('regulator-home__account-details')
      )
      expect(result).toEqual(expect.stringContaining('John'))
      expect(result).toEqual(expect.stringContaining('Doe'))
      expect(result).toEqual(
        expect.stringContaining('Example Environment Agency')
      )
      expect(result).toEqual(expect.stringContaining('Log out'))
      expect(result).toEqual(expect.stringContaining('href="/logout"'))
      expect(result).not.toEqual(
        expect.stringContaining('Certificate of Compliance placeholder')
      )
      expect(statusCode).toBe(statusCodes.ok)
    })

    test('Should render "Manage your account" link', async () => {
      const { result } = await getHomeAsAuthenticatedUser(server)

      expect(result).toEqual(expect.stringContaining('Manage your account'))
      expect(result).toEqual(
        expect.stringContaining(
          'href="https://example.org/regulators/manage-account/manage"'
        )
      )
    })

    test('Should render "Manage applications for approved and delegated people" link', async () => {
      const { result } = await getHomeAsAuthenticatedUser(server)

      expect(result).toEqual(
        expect.stringContaining(
          'Manage applications for approved and delegated people'
        )
      )
      expect(result).toEqual(
        expect.stringContaining(
          'href="https://example.org/regulators/applications"'
        )
      )
    })

    test('Should render "Manage registration submissions" link', async () => {
      const { result } = await getHomeAsAuthenticatedUser(server)

      expect(result).toEqual(
        expect.stringContaining('Manage registration submissions')
      )
      expect(result).toEqual(
        expect.stringContaining(
          'href="https://example.org/regulators/manage-registration-submissions"'
        )
      )
    })

    test('Should render "Manage packaging data submissions" link', async () => {
      const { result } = await getHomeAsAuthenticatedUser(server)

      expect(result).toEqual(
        expect.stringContaining('Manage packaging data submissions')
      )
      expect(result).toEqual(
        expect.stringContaining(
          'href="https://example.org/regulators/manage-packaging-data-submissions"'
        )
      )
    })

    test('Should render "Manage organisation details submissions" link', async () => {
      const { result } = await getHomeAsAuthenticatedUser(server)

      expect(result).toEqual(
        expect.stringContaining('Manage organisation details submissions')
      )
      expect(result).toEqual(
        expect.stringContaining(
          'href="https://example.org/regulators/manage-registrations"'
        )
      )
    })

    test('Should render "Manage organisation and their approved person" link', async () => {
      const { result } = await getHomeAsAuthenticatedUser(server)

      expect(result).toEqual(
        expect.stringContaining(
          'Manage organisation and their approved person'
        )
      )
      expect(result).toEqual(
        expect.stringContaining(
          'href="https://example.org/regulators/regulator-search-page"'
        )
      )
    })
  })

  describe('with FEATURE_CERTIFICATE_OF_COMPLIANCE=true', () => {
    let server
    let originalFetch

    beforeAll(async () => {
      vi.stubEnv('FEATURE_CERTIFICATE_OF_COMPLIANCE', 'true')
      vi.resetModules()
      const { createServer: createFreshServer } = await import('../server.js')
      server = await createFreshServer()
      await server.initialize()
    })

    beforeEach(() => {
      originalFetch = globalThis.fetch
      const mockFetch = mockGatewayAccountFetch()
      globalThis.fetch = mockFetch
      global.fetch = mockFetch
    })

    afterEach(() => {
      globalThis.fetch = originalFetch
      global.fetch = originalFetch
    })

    afterAll(async () => {
      await server.stop({ timeout: 0 })
      vi.unstubAllEnvs()
    })

    test('Should render "View certificates and statements of compliance" link', async () => {
      const { result, statusCode } = await getHomeAsAuthenticatedUser(server)

      expect(result).toEqual(
        expect.stringContaining(
          'View certificates and statements of compliance'
        )
      )
      expect(statusCode).toBe(statusCodes.ok)
    })
  })
})
