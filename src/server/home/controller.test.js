import { vi } from 'vitest'

import { createServer } from '../server.js'
import { config } from '../../config/config.js'
import { statusCodes } from '../common/constants/status-codes.js'

let originalAzureBase
let originalCertificateOfComplianceBase
let originalUseMockAuth
let originalUseMockApi

beforeAll(() => {
  originalUseMockAuth = config.get('useMockAuth')
  originalUseMockApi = config.get('useMockApi')
  originalAzureBase = config.get('services.regulatorAzure.baseUrl')
  originalCertificateOfComplianceBase = config.get(
    'services.certificateOfCompliance.baseUrl'
  )
  config.set('useMockAuth', true)
  config.set('useMockApi', true)
  config.set('services.regulatorAzure.baseUrl', 'https://example.org')
  config.set('services.certificateOfCompliance.baseUrl', 'https://example.org')
})

afterAll(() => {
  config.set('useMockAuth', originalUseMockAuth)
  config.set('useMockApi', originalUseMockApi)
  config.set('services.regulatorAzure.baseUrl', originalAzureBase)
  config.set(
    'services.certificateOfCompliance.baseUrl',
    originalCertificateOfComplianceBase
  )
})

async function getHomeAsAuthenticatedUser(server) {
  const signinResponse = await server.inject({
    method: 'GET',
    url: '/signin-oidc'
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

describe('#homeController', () => {
  describe('with default config', () => {
    let server

    beforeAll(async () => {
      server = await createServer()
      await server.initialize()
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
      expect(headers.location).toBe('/signin-oidc')
    })

    test('Should render dashboard when authenticated', async () => {
      const { result, statusCode } = await getHomeAsAuthenticatedUser(server)

      expect(result).toEqual(
        expect.stringContaining('pEPR: Regulators&#39; Service')
      )
      expect(result).toEqual(expect.stringContaining('John'))
      expect(result).toEqual(expect.stringContaining('Doe'))
      expect(result).toEqual(expect.stringContaining('Environment Agency'))
      expect(result).toEqual(expect.stringContaining('Sign out'))
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
        expect.stringContaining('Manage organisation and their approved person')
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

    beforeAll(async () => {
      vi.stubEnv('MOCK_AUTH', 'true')
      vi.stubEnv('MOCK_API', 'true')
      vi.stubEnv('FEATURE_CERTIFICATE_OF_COMPLIANCE', 'true')
      vi.stubEnv('CERTIFICATE_OF_COMPLIANCE_BASE_URL', 'https://example.org')
      vi.resetModules()
      const { createServer: createFreshServer } = await import('../server.js')
      server = await createFreshServer()
      await server.initialize()
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
      expect(result).toEqual(
        expect.stringContaining(
          'href="https://example.org/certificates-of-compliance"'
        )
      )
      expect(statusCode).toBe(statusCodes.ok)
    })
  })
})
