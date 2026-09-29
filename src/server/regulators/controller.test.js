import { createServer } from '../server.js'
import { config } from '../../config/config.js'
import { statusCodes } from '../common/constants/status-codes.js'

describe('#regulatorsController', () => {
  let server
  let originalUseMockAuth
  let originalCertificateOfCompliance
  let originalSiblingCookiePaths

  beforeAll(async () => {
    originalUseMockAuth = config.get('useMockAuth')
    originalCertificateOfCompliance = config.get(
      'features.certificateOfCompliance'
    )
    originalSiblingCookiePaths = config.get('auth.siblingCookiePaths')
    config.set('useMockAuth', true)
    config.set('features.certificateOfCompliance', false)
    config.set('auth.siblingCookiePaths', ['/certificates-of-compliance'])
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    config.set('useMockAuth', originalUseMockAuth)
    config.set(
      'features.certificateOfCompliance',
      originalCertificateOfCompliance
    )
    config.set('auth.siblingCookiePaths', originalSiblingCookiePaths)
    await server.stop({ timeout: 0 })
  })

  test('signin-oidc should redirect to /', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/signin-oidc'
    })

    expect(response.statusCode).toBe(statusCodes.found)
    expect(response.headers.location).toBe('/home')
  })

  test('signin-oidc should redirect to prefixed /home when behind a proxy', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/signin-oidc',
      headers: { 'x-forwarded-prefix': '/manage-waste-dashboard' }
    })

    expect(response.statusCode).toBe(statusCodes.found)
    expect(response.headers.location).toBe('/manage-waste-dashboard/home')
  })

  test('Should sign out (B2C logout URL or /signed-out)', async () => {
    const signInResponse = await server.inject({
      method: 'GET',
      url: '/signin-oidc'
    })
    const response = await server.inject({
      method: 'GET',
      url: '/logout',
      headers: {
        cookie: signInResponse.headers['set-cookie']
          .map((cookie) => cookie.split(';')[0])
          .join('; ')
      }
    })

    expect(response.statusCode).toBe(statusCodes.found)

    const setCookie = response.headers['set-cookie'] ?? []
    const cookieHeaders = Array.isArray(setCookie) ? setCookie : [setCookie]
    expect(
      cookieHeaders.some(
        (cookie) =>
          cookie.startsWith('session=') &&
          cookie.includes('Path=/certificates-of-compliance') &&
          cookie.includes('Max-Age=0')
      )
    ).toBe(true)
    expect(
      cookieHeaders.some(
        (cookie) =>
          cookie.startsWith('session=') &&
          /;\s*Path=\/(?:;|$)/.test(cookie) &&
          cookie.includes('Max-Age=0')
      )
    ).toBe(true)
    const { location } = response.headers
    expect(location).toBe('/signed-out')
  })

  test('Should sign out to prefixed /signed-out when behind a proxy', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/logout',
      headers: { 'x-forwarded-prefix': '/manage-waste-dashboard' }
    })

    expect(response.statusCode).toBe(statusCodes.found)
    const { location } = response.headers
    expect(location).toBe('/manage-waste-dashboard/signed-out')
  })

  test('Should chain logout through CSOC when the feature is enabled', async () => {
    const originalFeature = config.get('features.certificateOfCompliance')
    const originalBaseUrl = config.get(
      'services.certificateOfCompliance.baseUrl'
    )
    const originalUseMockAuth = config.get('useMockAuth')

    config.set('features.certificateOfCompliance', true)
    config.set('useMockAuth', false)
    config.set(
      'services.certificateOfCompliance.baseUrl',
      'https://localhost:3000'
    )

    try {
      const response = await server.inject({
        method: 'GET',
        url: '/logout',
        headers: { host: 'localhost:7154' }
      })

      expect(response.statusCode).toBe(statusCodes.found)

      const location = new URL(response.headers.location)
      expect(location.origin).toBe('https://localhost:3000')
      expect(location.pathname).toBe('/logout')
      expect(location.searchParams.get('returnTo')).toMatch(
        /^https?:\/\/localhost:7154\/signed-out$/
      )
    } finally {
      config.set('features.certificateOfCompliance', originalFeature)
      config.set('services.certificateOfCompliance.baseUrl', originalBaseUrl)
      config.set('useMockAuth', originalUseMockAuth)
    }
  })

  test('Should render signed-out page', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/signed-out'
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(expect.stringContaining('Signed out'))
    expect(result).toEqual(
      expect.stringContaining('You have signed out of the Regulator service.')
    )
    expect(result).toEqual(expect.stringContaining('Sign in'))
    expect(result).toEqual(expect.stringContaining('href="/signin-oidc"'))
    expect(result).not.toEqual(expect.stringContaining('Sign out'))
    expect(result).not.toEqual(expect.stringContaining('href="/logout"'))
  })
})
