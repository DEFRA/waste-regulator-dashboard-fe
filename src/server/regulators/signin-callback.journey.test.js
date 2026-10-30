import { http, HttpResponse } from 'msw'
import { getMockServer } from '#mocks/server.js'
import { createServer } from '#server/server.js'
import { statusCodes } from '#server/common/constants/status-codes.js'
import { mergeCookiesFromResponse } from '#test-helpers/cookies.js'

// The rest of the suite signs in through a stub strategy, so it never sees how
// Bell itself fails. These run the app with the real Bell strategy; the
// environment has to be in place before config is first imported, and Vitest
// runs vi.hoisted before the imports above.
const B2C = vi.hoisted(() => {
  const b2c = {
    instance: 'https://b2c.example.test',
    domain: 'tenant.onmicrosoft.com',
    userFlow: 'B2C_1A_TEST'
  }
  const env = {
    MOCK_AUTH: 'false',
    AZURE_AD_B2C_CLIENT_ID: 'client-id',
    AZURE_AD_B2C_CLIENT_SECRET: 'client-secret',
    AZURE_AD_B2C_INSTANCE: b2c.instance,
    AZURE_AD_B2C_DOMAIN: b2c.domain,
    AZURE_AD_B2C_USER_FLOW: b2c.userFlow,
    AUTH_COOKIE_SECURE: 'false',
    // B2C and the Account API are answered by MSW. A proxy from the shell
    // would route Bell's token exchange past MSW, so it is cleared.
    MOCK_API: 'true',
    HTTP_PROXY: undefined
  }
  b2c.previousEnv = Object.fromEntries(
    Object.keys(env).map((key) => [key, process.env[key]])
  )
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
  return b2c
})

const AUTHORITY = `${B2C.instance}/${B2C.domain}/${B2C.userFlow}`
const SIGN_IN_FAILED = 'Sorry, there was a problem signing you in'

function idTokenFor(claims) {
  const encode = (value) =>
    Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${encode({ alg: 'none' })}.${encode(claims)}.signature`
}

function respondFromTokenEndpoint(resolver) {
  getMockServer().use(http.post(`${AUTHORITY}/oauth2/v2.0/token`, resolver))
}

function issueTokensFor(oid) {
  respondFromTokenEndpoint(() =>
    HttpResponse.json({
      access_token: 'secret-access-token',
      id_token: idTokenFor({ oid, email: 'person@example.com' }),
      token_type: 'Bearer',
      expires_in: 3600
    })
  )
}

describe('/signin-oidc with the real Bell strategy', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
    for (const [key, value] of Object.entries(B2C.previousEnv)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  })

  afterEach(() => {
    getMockServer().resetHandlers()
  })

  const get = (url, cookie) =>
    server.inject({ method: 'GET', url, headers: cookie ? { cookie } : {} })

  // Starts sign-in the way a browser does, so a test can come back to the
  // callback holding a genuine state cookie and nonce.
  async function startSignIn() {
    const response = await get('/signin-oidc')
    return {
      response,
      cookie: mergeCookiesFromResponse('', response),
      state: new URL(response.headers.location).searchParams.get('state')
    }
  }

  // A failed callback redirects to the sign-in-failed page, so the code and
  // state leave the address bar; following it shows the page itself.
  async function expectSentToSignInFailed(response) {
    expect(response.statusCode).toBe(statusCodes.found)
    expect(response.headers.location).toBe('/sign-in-failed')

    const page = await get(response.headers.location)
    expect(page.statusCode).toBe(statusCodes.ok)
    expect(page.payload).toContain(SIGN_IN_FAILED)
    expect(page.payload).toContain(
      'Try to <a class="govuk-link" href="/signin-oidc">sign in again</a>.'
    )
    expect(page.payload).toContain('eprcustomerservice@defra.gov.uk')
    expect(page.payload).toContain('if you need help')
  }

  test('still sends a new sign-in to B2C', async () => {
    const { response, state } = await startSignIn()

    expect(response.statusCode).toBe(statusCodes.found)
    expect(response.headers.location).toContain(
      `${AUTHORITY}/oauth2/v2.0/authorize`
    )
    expect(state).toBeTruthy()
  })

  test('signs a regulator in', async () => {
    issueTokensFor('regulator-oid')
    const { cookie, state } = await startSignIn()

    const response = await get(
      `/signin-oidc?code=auth-code&state=${state}`,
      cookie
    )

    expect(response.statusCode).toBe(statusCodes.found)
    expect(response.headers.location).toBe('/home')
  })

  test('handles B2C returning access_denied', async () => {
    const { cookie } = await startSignIn()

    const response = await get(
      '/signin-oidc?error=access_denied&error_description=AADB2C90091%3A+cancelled',
      cookie
    )

    await expectSentToSignInFailed(response)
  })

  test('handles a state that does not match the state cookie', async () => {
    const { cookie } = await startSignIn()

    const response = await get(
      '/signin-oidc?code=auth-code&state=not-the-issued-state',
      cookie
    )

    await expectSentToSignInFailed(response)
  })

  test('lets Bell retry once when the state cookie is missing', async () => {
    const response = await get('/signin-oidc?code=auth-code&state=some-state')

    expect(response.statusCode).toBe(statusCodes.ok)
    expect(response.payload).toContain('http-equiv="refresh"')
  })

  test('handles a state cookie still missing after that retry', async () => {
    const response = await get(
      '/signin-oidc?code=auth-code&state=some-state&refresh=1'
    )

    await expectSentToSignInFailed(response)
  })

  test('handles a failed code-for-token exchange', async () => {
    let tokenEndpointCalled = false
    respondFromTokenEndpoint(() => {
      tokenEndpointCalled = true
      return HttpResponse.json({ error: 'invalid_grant' }, { status: 400 })
    })
    const { cookie, state } = await startSignIn()

    const response = await get(
      `/signin-oidc?code=auth-code&state=${state}`,
      cookie
    )

    // Fails because B2C refused the code, not because the request never
    // reached the mocked token endpoint.
    expect(tokenEndpointCalled).toBe(true)
    await expectSentToSignInFailed(response)
  })

  // A callback that comes back with a state Bell has already spent, as a
  // reload or Back to B2C's sign-in page after signing in can do.
  test('takes a replayed callback on to returnTo once signed in', async () => {
    issueTokensFor('regulator-oid')
    const { cookie, state } = await startSignIn()
    const callback = `/signin-oidc?code=auth-code&state=${state}`
    const signedIn = await get(callback, cookie)

    const replay = await get(
      `/signin-oidc?code=another-code&state=${state}&refresh=1`,
      mergeCookiesFromResponse(cookie, signedIn)
    )

    expect(replay.statusCode).toBe(statusCodes.found)
    expect(replay.headers.location).toBe('/home')
  })
})
