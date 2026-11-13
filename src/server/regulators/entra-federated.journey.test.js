import { STSClient } from '@aws-sdk/client-sts'
import { createServer } from '#server/server.js'
import { statusCodes } from '#server/common/constants/status-codes.js'
import { mergeCookiesFromResponse } from '#test-helpers/cookies.js'
import {
  entraIdUrls,
  fakeAccessToken,
  fakeEntraIdFetch
} from '#test-helpers/fake-entra-id.js'

// The AWS token the federated provider would get from STS on CDP
const STS = vi.hoisted(() => {
  const encode = (value) =>
    Buffer.from(JSON.stringify(value)).toString('base64url')
  const token = `${encode({ alg: 'RS256' })}.${encode({ exp: Math.floor(Date.now() / 1000) + 3000, sub: 'task-role' })}.sig`
  return { token }
})

const ENV = vi.hoisted(() => {
  const env = {
    AUTH_PROVIDER: 'entra',
    ENTRA_ID_AUTHORITY: 'https://login.test/tenant-id',
    ENTRA_ID_CLIENT_ID: 'frontend-client-id',
    ENTRA_ID_CLIENT_SECRET: undefined,
    ENTRA_ID_CREDENTIAL_TYPE: 'federated',
    ENTRA_ID_REQUIRED_ROLE: 'Waste.Regulator.Standard',
    ENTRA_ID_API_SCOPE: 'api://frontend-client-id/.default',
    ENTRA_ID_EXTERNAL_BASE_URL: 'http://localhost:7154/regulators',
    FEDERATED_CREDENTIALS_AUDIENCE: 'waste-regulator-dashboard-fe',
    AUTH_COOKIE_SECURE: 'false',
    MOCK_AUTH: 'false',
    MOCK_API: 'true',
    HTTP_PROXY: undefined,
    // The AWS client takes its task credentials from the environment
    AWS_REGION: 'eu-west-2',
    AWS_ACCESS_KEY_ID: 'test-key',
    AWS_SECRET_ACCESS_KEY: 'test-secret',
    AWS_SESSION_TOKEN: 'test-session',
    AWS_CREDENTIAL_EXPIRATION: new Date(Date.now() + 3600 * 1000).toISOString()
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

function accessTokenWithRoles(roles, expiresIn = 3600) {
  const [header, payload, signature] = fakeAccessToken({ expiresIn }).split('.')
  const claims = { ...JSON.parse(Buffer.from(payload, 'base64url')), roles }
  return `${header}.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.${signature}`
}

describe('Entra ID with a federated credential, a required role and a path prefix', () => {
  let server
  // Recorded here: the token is fetched once, not in each test
  const stsRequests = []

  beforeAll(async () => {
    vi.spyOn(STSClient.prototype, 'send').mockImplementation(
      async (command) => {
        stsRequests.push(command.input)
        return { WebIdentityToken: STS.token }
      }
    )
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
    for (const [key, value] of Object.entries(ENV)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  afterEach(() => {
    globalThis.fetch.mockRestore?.()
  })

  const get = (url, cookie) =>
    server.inject({ method: 'GET', url, headers: cookie ? { cookie } : {} })

  // Entra ID calls go to the fake; the mocked Account API still goes through
  function entraFetch(entraId) {
    const realFetch = globalThis.fetch
    const fake = fakeEntraIdFetch(entraId)
    const spy = vi.spyOn(globalThis, 'fetch')
    spy.mockImplementation((url, init) =>
      String(url).startsWith('https://login.test')
        ? fake(url, init)
        : realFetch(url, init)
    )
    return spy
  }

  const tokenBodies = (spy) =>
    spy.mock.calls
      .filter(([url]) => String(url) === entraIdUrls.token)
      .map(([, init]) => new URLSearchParams(String(init?.body)))

  async function signIn(entraId) {
    const spy = entraFetch(entraId)
    const start = await get('/signin-oidc')
    const authorizeUrl = new URL(start.headers.location)
    entraFetch({
      ...entraId,
      claims: {
        nonce: authorizeUrl.searchParams.get('nonce'),
        ...entraId.claims
      }
    })
    const cookie = mergeCookiesFromResponse('', start)
    const callback = await get(
      `/signin-oidc?code=auth-code&state=${authorizeUrl.searchParams.get('state')}`,
      cookie
    )
    return {
      start,
      callback,
      spy,
      cookie: mergeCookiesFromResponse(cookie, callback)
    }
  }

  test('asks Entra ID to come back to the prefixed callback URL', async () => {
    entraFetch({})
    const start = await get('/signin-oidc')
    expect(
      new URL(start.headers.location).searchParams.get('redirect_uri')
    ).toBe('http://localhost:7154/regulators/signin-oidc')
  })

  test('sends the AWS STS token as the client assertion and no client secret', async () => {
    const { callback, spy } = await signIn({
      accessToken: accessTokenWithRoles(['Waste.Regulator.Standard']),
      claims: { oid: MOCK_ACCOUNT_OID }
    })

    expect(callback.statusCode).toBe(statusCodes.found)
    expect(callback.headers.location).toBe('/home')
    const [body] = tokenBodies(spy)
    expect(body.get('client_assertion')).toBe(STS.token)
    expect(body.get('client_assertion_type')).toBe(
      'urn:ietf:params:oauth:client-assertion-type:jwt-bearer'
    )
    expect(body.has('client_secret')).toBe(false)
    // Same redirect URI as at authorize, though the proxy strips the prefix
    expect(body.get('redirect_uri')).toBe(
      'http://localhost:7154/regulators/signin-oidc'
    )
    expect(stsRequests[0]).toMatchObject({
      Audience: ['waste-regulator-dashboard-fe']
    })
  })

  test('refuses a user without the required role and does not sign them in', async () => {
    const { callback, cookie } = await signIn({
      accessToken: accessTokenWithRoles(['Some.Other.Role']),
      claims: { oid: MOCK_ACCOUNT_OID }
    })

    expect(callback.statusCode).toBe(statusCodes.forbidden)
    const home = await get('/home', cookie)
    expect(home.headers.location).toBe('/signin-oidc')
  })

  test('signs the user out when a refresh shows the role has gone', async () => {
    const { cookie } = await signIn({
      accessToken: accessTokenWithRoles(['Waste.Regulator.Standard'], 60),
      claims: { oid: MOCK_ACCOUNT_OID }
    })

    entraFetch({ accessToken: accessTokenWithRoles([]) })
    const home = await get('/home', cookie)

    expect(home.statusCode).toBe(statusCodes.found)
    expect(home.headers.location).toBe('/signin-oidc')
  })

  test('signs the user out when a refresh leaves out the roles claim', async () => {
    const { cookie } = await signIn({
      accessToken: accessTokenWithRoles(['Waste.Regulator.Standard'], 60),
      claims: { oid: MOCK_ACCOUNT_OID }
    })

    // Entra ID omits the claim when the user has no roles left
    entraFetch({ accessToken: fakeAccessToken() })
    const home = await get('/home', cookie)

    expect(home.statusCode).toBe(statusCodes.found)
    expect(home.headers.location).toBe('/signin-oidc')
  })

  test('signs out through Entra ID back to the prefixed signed-out page', async () => {
    const out = await get('/logout')
    const logout = new URL(out.headers.location)
    expect(logout.searchParams.get('post_logout_redirect_uri')).toBe(
      'http://localhost:7154/regulators/signed-out'
    )
  })
})
