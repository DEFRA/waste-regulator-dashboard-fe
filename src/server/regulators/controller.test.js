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

  test('Should sign out locally when CSOC shares the reverse-proxy origin', async () => {
    const originalFeature = config.get('features.certificateOfCompliance')
    const originalBaseUrl = config.get(
      'services.certificateOfCompliance.baseUrl'
    )
    const originalUseMockAuth = config.get('useMockAuth')
    const originalAzure = config.get('auth.azureAdB2c')

    config.set('features.certificateOfCompliance', true)
    config.set(
      'services.certificateOfCompliance.baseUrl',
      'https://regulators-waste-proxy.dev.cdp-int.defra.cloud'
    )
    config.set('auth.azureAdB2c', {
      ...originalAzure,
      postLogoutRedirectPath:
        'https://regulators-waste-proxy.dev.cdp-int.defra.cloud/dashboard/signed-out'
    })

    try {
      const response = await server.inject({
        method: 'GET',
        url: '/logout',
        headers: {
          host: 'regulators-waste-proxy.dev.cdp-int.defra.cloud',
          'x-forwarded-proto': 'https',
          'x-forwarded-prefix': '/dashboard'
        }
      })

      expect(response.statusCode).toBe(statusCodes.found)
      expect(response.headers.location).toBe('/dashboard/signed-out')
    } finally {
      config.set('features.certificateOfCompliance', originalFeature)
      config.set('services.certificateOfCompliance.baseUrl', originalBaseUrl)
      config.set('useMockAuth', originalUseMockAuth)
      config.set('auth.azureAdB2c', originalAzure)
    }
  })

  test('Should chain logout through CSOC when the feature is enabled', async () => {
    const originalFeature = config.get('features.certificateOfCompliance')
    const originalBaseUrl = config.get(
      'services.certificateOfCompliance.baseUrl'
    )
    const originalUseMockAuth = config.get('useMockAuth')
    const originalAzure = config.get('auth.azureAdB2c')

    config.set('features.certificateOfCompliance', true)
    config.set('useMockAuth', false)
    config.set(
      'services.certificateOfCompliance.baseUrl',
      'https://localhost:3000'
    )
    config.set('auth.azureAdB2c', {
      ...originalAzure,
      postLogoutRedirectPath: 'https://localhost:7154/signed-out'
    })

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
      config.set('auth.azureAdB2c', originalAzure)
    }
  })

  test('Should render signed-out page', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/signed-out'
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(expect.stringContaining('Signed out'))
    expect(result).toEqual(expect.stringContaining('You have signed out.'))
    expect(result).not.toEqual(expect.stringContaining('Sign out'))
    expect(result).not.toEqual(expect.stringContaining('href="/logout"'))
  })

  test('Should render signed-out page and respect forwarded prefix for sign in link', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/signed-out',
      headers: { 'x-forwarded-prefix': '/manage-waste-dashboard' }
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(
      expect.stringContaining('href="/manage-waste-dashboard/signin-oidc"')
    )
  })

  test('Should render sign-in-failed page with a link to try again', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/sign-in-failed'
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(
      expect.stringContaining('Sorry, there was a problem signing you in')
    )
    expect(result).toEqual(
      expect.stringContaining(
        'Try to <a class="govuk-link" href="/signin-oidc">sign in again</a>.'
      )
    )
    expect(result).toEqual(
      expect.stringContaining('eprcustomerservice@defra.gov.uk')
    )
  })

  test('Should not show the cookie banner on the sign-in-failed page', async () => {
    const signedOut = await server.inject({
      method: 'GET',
      url: '/signed-out'
    })
    const signInFailed = await server.inject({
      method: 'GET',
      url: '/sign-in-failed'
    })

    // The banner shows on other pages for someone with no cookie preference.
    expect(signedOut.result).toContain('govuk-cookie-banner')
    expect(signInFailed.result).not.toContain('govuk-cookie-banner')
  })

  test('Should keep Welsh on the sign-in-failed try-again link, with English text until it is translated', async () => {
    const { result, statusCode } = await server.inject({
      method: 'GET',
      url: '/sign-in-failed?lang=cy'
    })

    expect(statusCode).toBe(statusCodes.ok)
    expect(result).toEqual(
      expect.stringContaining('Sorry, there was a problem signing you in')
    )
    expect(result).toEqual(
      expect.stringContaining('href="/signin-oidc?lang=cy"')
    )
  })

  test('Should link the sign-in-failed retry to /signin-oidc behind the proxy prefix', async () => {
    const { result } = await server.inject({
      method: 'GET',
      url: '/sign-in-failed',
      headers: { 'x-forwarded-prefix': '/dashboard' }
    })

    expect(result).toEqual(
      expect.stringContaining('href="/dashboard/signin-oidc"')
    )
  })
})
