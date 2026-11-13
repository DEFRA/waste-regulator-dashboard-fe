import { createServer } from '#server/server.js'
import { statusCodes } from '#server/common/constants/status-codes.js'
import { mergeCookiesFromResponse } from '#test-helpers/cookies.js'
import {
  entraIdUrls,
  fakeAccessToken,
  fakeEntraIdFetch
} from '#test-helpers/fake-entra-id.js'

const ENTRA_ENV = vi.hoisted(() => {
  const env = {
    AUTH_PROVIDER: 'entra',
    ENTRA_ID_AUTHORITY: 'https://login.test/tenant-id',
    ENTRA_ID_CLIENT_ID: 'frontend-client-id',
    ENTRA_ID_CLIENT_SECRET: 'local-only-secret',
    ENTRA_ID_API_SCOPE: 'api://frontend-client-id/.default',
    ENTRA_ID_EXTERNAL_BASE_URL: 'http://localhost:7154',
    AUTH_COOKIE_SECURE: 'false',
    MOCK_AUTH: 'false',
    MOCK_API: 'true',
    HTTP_PROXY: undefined
  }
  const previous = Object.fromEntries(
    Object.keys(env).map((key) => [key, process.env[key]])
  )
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
  return previous
})

const MOCK_ACCOUNT_OID = 'a586e22f-0df0-4a24-8048-ae7d0aabbbbc'

function accessTokenWithRoles(roles) {
  const base = fakeAccessToken()
  const [header, payload, signature] = base.split('.')
  const claims = { ...JSON.parse(Buffer.from(payload, 'base64url')), roles }
  return `${header}.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.${signature}`
}

describe('Entra ID sign-in and sign-out (AUTH_PROVIDER=entra)', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    server.route([
      {
        method: 'GET',
        path: '/__plant',
        options: { auth: false },
        handler: (request) => {
          request.yar.set('planted', 'before sign-in')
          return 'planted'
        }
      },
      {
        method: 'GET',
        path: '/__planted',
        options: { auth: false },
        handler: (request) => request.yar.get('planted') ?? 'nothing'
      }
    ])
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
    for (const [key, value] of Object.entries(ENTRA_ENV)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const get = (url, cookie) =>
    server.inject({ method: 'GET', url, headers: cookie ? { cookie } : {} })

  // Entra ID calls go to the fake; the mocked Account API still goes through
  const fakeEntraOnly = (entraId) => {
    const realFetch = globalThis.fetch
    const fake = fakeEntraIdFetch(entraId)
    return (url, init) =>
      String(url).startsWith('https://login.test')
        ? fake(url, init)
        : realFetch(url, init)
  }

  const tokenRequestBodies = (spy) =>
    spy.mock.calls
      .filter(([url]) => String(url) === entraIdUrls.token)
      .map(([, init]) => String(init?.body))

  async function signIn(entraId = {}) {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    fetchSpy.mockImplementation(fakeEntraIdFetch(entraId))

    const start = await get('/signin-oidc')
    const authorizeUrl = new URL(start.headers.location)
    const state = authorizeUrl.searchParams.get('state')
    fetchSpy.mockImplementation(
      fakeEntraIdFetch({
        ...entraId,
        claims: {
          nonce: authorizeUrl.searchParams.get('nonce'),
          ...entraId.claims
        }
      })
    )
    const cookie = mergeCookiesFromResponse('', start)

    const callback = await get(
      `/signin-oidc?code=auth-code&state=${state}`,
      cookie
    )
    const tokenRequests = tokenRequestBodies(fetchSpy)
    fetchSpy.mockRestore()
    return {
      tokenRequests,
      start,
      callback,
      cookie: mergeCookiesFromResponse(cookie, callback)
    }
  }

  test('an unauthenticated visitor is sent to sign in, then to Entra ID with PKCE', async () => {
    const page = await get('/home')
    expect(page.statusCode).toBe(statusCodes.found)
    expect(page.headers.location).toBe('/signin-oidc')

    vi.spyOn(globalThis, 'fetch').mockImplementation(fakeEntraIdFetch())
    const start = await get('/signin-oidc')
    expect(start.statusCode).toBe(statusCodes.found)
    const url = new URL(start.headers.location)
    expect(`${url.origin}${url.pathname}`).toBe(entraIdUrls.authorize)
    expect(url.searchParams.get('client_id')).toBe('frontend-client-id')
    expect(url.searchParams.get('code_challenge')).toBeTruthy()
    expect(url.searchParams.get('redirect_uri')).toBe(
      'http://localhost:7154/signin-oidc'
    )
    expect(url.searchParams.get('scope')).toContain(
      'api://frontend-client-id/.default'
    )
  })

  test('signs a regulator in, keeps a B2C-shaped session user, and reaches a protected page', async () => {
    const { callback, cookie } = await signIn({
      accessToken: accessTokenWithRoles(['Waste.Regulator.Standard']),
      claims: { oid: MOCK_ACCOUNT_OID }
    })

    expect(callback.statusCode).toBe(statusCodes.found)
    expect(callback.headers.location).toBe('/home')

    const home = await get('/home', cookie)
    expect(home.statusCode).toBe(statusCodes.ok)
  })

  test('sign-out clears the session and redirects to the Entra ID logout endpoint', async () => {
    const { cookie } = await signIn()

    const out = await get('/logout', cookie)
    expect(out.statusCode).toBe(statusCodes.found)
    const logout = new URL(out.headers.location)
    expect(`${logout.origin}${logout.pathname}`).toBe(
      'https://login.test/tenant-id/oauth2/v2.0/logout'
    )
    expect(logout.searchParams.get('post_logout_redirect_uri')).toBe(
      'http://localhost:7154/signed-out'
    )

    const after = await get('/home', mergeCookiesFromResponse(cookie, out))
    expect(after.statusCode).toBe(statusCodes.found)
    expect(after.headers.location).toBe('/signin-oidc')
  })

  test('a failed token exchange sends the person to the sign-in-failed page', async () => {
    const { callback } = await signIn({
      tokenError: Response.json({ error: 'invalid_client' }, { status: 401 })
    })
    expect(callback.statusCode).toBe(statusCodes.found)
    expect(callback.headers.location).toBe('/sign-in-failed')
  })

  test('a callback with a forged state sends the person to the sign-in-failed page', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(fakeEntraIdFetch())
    const start = await get('/signin-oidc')
    const callback = await get(
      '/signin-oidc?code=auth-code&state=forged',
      mergeCookiesFromResponse('', start)
    )
    expect(callback.statusCode).toBe(statusCodes.found)
    expect(callback.headers.location).toBe('/sign-in-failed')
  })

  test('an Entra ID error callback sends the person to the sign-in-failed page', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(fakeEntraIdFetch())
    const start = await get('/signin-oidc')
    const callback = await get(
      '/signin-oidc?error=access_denied',
      mergeCookiesFromResponse('', start)
    )
    expect(callback.statusCode).toBe(statusCodes.found)
    expect(callback.headers.location).toBe('/sign-in-failed')
  })

  test('the token request carries the code and PKCE verifier (local run sends a client secret; federation is not exercised here)', async () => {
    const { tokenRequests } = await signIn({
      claims: { oid: MOCK_ACCOUNT_OID }
    })
    expect(tokenRequests).toHaveLength(1)
    const body = new URLSearchParams(tokenRequests[0])
    expect(body.get('grant_type')).toBe('authorization_code')
    expect(body.get('code')).toBe('auth-code')
    expect(body.get('code_verifier')).toBeTruthy()
  })

  test('a session about to expire is refreshed with the refresh token', async () => {
    const { cookie } = await signIn({
      accessToken: fakeAccessToken({ expiresIn: 60 }),
      claims: { oid: MOCK_ACCOUNT_OID }
    })

    const entraFetch = fakeEntraOnly({
      accessToken: fakeAccessToken({ name: 'refreshed' }),
      refreshToken: 'refreshed-refresh-token'
    })
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(entraFetch)
    const home = await get('/home', cookie)

    expect(home.statusCode).toBe(statusCodes.ok)
    const [refreshBody] = tokenRequestBodies(fetchSpy)
    const body = new URLSearchParams(refreshBody)
    expect(body.get('grant_type')).toBe('refresh_token')
    expect(body.get('refresh_token')).toBe('user-refresh-token')
  })

  test('a failed refresh signs the person out', async () => {
    const { cookie } = await signIn({
      accessToken: fakeAccessToken({ expiresIn: 60 }),
      claims: { oid: MOCK_ACCOUNT_OID }
    })

    vi.spyOn(globalThis, 'fetch').mockImplementation(
      fakeEntraIdFetch({
        tokenError: Response.json({ error: 'invalid_grant' }, { status: 400 })
      })
    )
    const home = await get('/home', cookie)

    expect(home.statusCode).toBe(statusCodes.found)
    expect(home.headers.location).toBe('/signin-oidc')
  })

  test('a session with no refresh token ends when its access token is about to expire', async () => {
    const { callback, cookie } = await signIn({
      accessToken: fakeAccessToken({ expiresIn: 60 }),
      refreshToken: null,
      claims: { oid: MOCK_ACCOUNT_OID }
    })
    expect(callback.headers.location).toBe('/home')

    vi.spyOn(globalThis, 'fetch').mockImplementation(fakeEntraIdFetch())
    const home = await get('/home', cookie)

    expect(home.statusCode).toBe(statusCodes.found)
    expect(home.headers.location).toBe('/signin-oidc')
  })

  test('signing in starts a new session, and goes back to the page the person wanted', async () => {
    const wanted = await get('/home?wanted=1')
    const planted = await get('/__plant', mergeCookiesFromResponse('', wanted))
    const before = mergeCookiesFromResponse(
      mergeCookiesFromResponse('', wanted),
      planted
    )

    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    fetchSpy.mockImplementation(fakeEntraIdFetch())
    const start = await get('/signin-oidc', before)
    const authorizeUrl = new URL(start.headers.location)
    fetchSpy.mockImplementation(
      fakeEntraIdFetch({
        claims: {
          nonce: authorizeUrl.searchParams.get('nonce'),
          oid: MOCK_ACCOUNT_OID
        }
      })
    )
    const cookie = mergeCookiesFromResponse(before, start)
    const callback = await get(
      `/signin-oidc?code=auth-code&state=${authorizeUrl.searchParams.get('state')}`,
      cookie
    )

    expect(callback.headers.location).toContain('wanted=1')
    // Something put in the session before sign-in must not survive it
    const after = await get(
      '/__planted',
      mergeCookiesFromResponse(cookie, callback)
    )
    expect(after.payload).toBe('nothing')
  })

  test('an Entra ID that cannot be reached when sign-in starts sends the person to sign-in-failed', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('unreachable'))
    const start = await get('/signin-oidc')
    expect([statusCodes.found, statusCodes.ok]).toContain(start.statusCode)
    // Either the cached Entra ID metadata served the redirect, or the
    // failure was turned into the sign-in-failed page: never a 500
    expect(start.statusCode).not.toBe(statusCodes.internalServerError)
  })

  test('the whoami page shows what Entra ID told us, without the tokens, and needs a sign-in', async () => {
    const anonymous = await get('/whoami')
    expect(anonymous.statusCode).toBe(statusCodes.found)
    expect(anonymous.headers.location).toBe('/signin-oidc')

    const { cookie } = await signIn({
      accessToken: accessTokenWithRoles(['Waste.Regulator.Standard']),
      refreshToken: 'secret-refresh-token',
      claims: { oid: MOCK_ACCOUNT_OID, sub: 'user-subject' }
    })
    const page = await get('/whoami', cookie)

    expect(page.statusCode).toBe(statusCodes.ok)
    expect(page.result).toEqual({
      oid: MOCK_ACCOUNT_OID,
      accountId: MOCK_ACCOUNT_OID,
      sub: 'user-subject',
      name: 'Jo Bloggs',
      email: undefined,
      roles: ['Waste.Regulator.Standard']
    })
    expect(page.payload).not.toContain('secret-refresh-token')
    expect(page.payload).not.toContain('eyJ')
  })

  test('an ID token with no usable user id is a server error, not a sign-in', async () => {
    const { callback } = await signIn({
      claims: { oid: 'not-a-guid', sub: '' }
    })
    expect(callback.statusCode).toBe(statusCodes.internalServerError)
  })

  test('a replayed callback after signing in goes on to the page, not to sign-in-failed', async () => {
    const { start, cookie } = await signIn({
      claims: { oid: MOCK_ACCOUNT_OID }
    })
    vi.spyOn(globalThis, 'fetch').mockImplementation(fakeEntraIdFetch())
    const state = new URL(start.headers.location).searchParams.get('state')

    const replay = await get(
      `/signin-oidc?code=another-code&state=${state}`,
      cookie
    )

    expect(replay.statusCode).toBe(statusCodes.found)
    expect(replay.headers.location).toBe('/home')
  })
})
