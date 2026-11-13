import { WebIdentityTokenProvider } from '@defra/hapi-auth-oidc'
import { STSClient } from '@aws-sdk/client-sts'
import { config } from '../../config/config.js'
import {
  createEntraUserSession,
  entraExternalUrls,
  entraIdDiscoveryUri,
  entraSignOutUrl,
  hasRequiredEntraRole,
  entraIdAuthProvider,
  missingEntraIdSettings,
  updateEntraUserSession
} from './entra-id.js'

function jwt(payload) {
  const enc = (v) => Buffer.from(JSON.stringify(v)).toString('base64url')
  return `${enc({ alg: 'RS256' })}.${enc(payload)}.sig`
}

describe('entra-id', () => {
  test('on CDP the federated provider asks AWS STS for a token for our audience and returns it as the credential', async () => {
    const get = config.get.bind(config)
    vi.spyOn(config, 'get').mockImplementation((key) =>
      key === 'auth.entraId.credentialType' ? 'federated' : get(key)
    )
    const exp = Math.floor(Date.now() / 1000) + 300
    const stsToken = jwt({ exp, iss: 'https://sts.test', sub: 'task-role' })
    const send = vi
      .spyOn(STSClient.prototype, 'send')
      .mockResolvedValue({ WebIdentityToken: stsToken })

    const provider = entraIdAuthProvider()
    provider.stsClient.config.credentials = vi
      .fn()
      .mockResolvedValue({ expiration: new Date(Date.now() + 3600 * 1000) })

    expect(provider.type).toBe('federated')
    await expect(provider.getCredentials()).resolves.toBe(stsToken)
    expect(send.mock.calls[0][0].input).toMatchObject({
      Audience: ['waste-regulator-dashboard-fe'],
      SigningAlgorithm: 'RS256'
    })
  })

  test('refreshing keeps the profile and takes roles from the new access token', () => {
    const user = {
      token: 'old',
      refreshToken: 'r',
      profile: { oid: 'o', roles: ['A'] }
    }
    const updated = updateEntraUserSession(user, {
      accessToken: jwt({ roles: ['B'] })
    })
    expect(updated.profile).toEqual({ oid: 'o', roles: ['B'] })
    expect(updated.refreshToken).toBe('r')
  })

  test('on CDP the public base URL must be set, not left at the local default', () => {
    const get = config.get.bind(config)
    vi.spyOn(config, 'get').mockImplementation((key) =>
      key === 'isProduction' ? true : get(key)
    )
    expect(missingEntraIdSettings()).toContain('ENTRA_ID_EXTERNAL_BASE_URL')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  test('uses a federated credential (no secret) in production', () => {
    const get = config.get.bind(config)
    vi.spyOn(config, 'get').mockImplementation((key) =>
      key === 'auth.entraId.credentialType' ? 'federated' : get(key)
    )

    expect(entraIdAuthProvider()).toBeInstanceOf(WebIdentityTokenProvider)
    expect(missingEntraIdSettings()).not.toContain('ENTRA_ID_CLIENT_SECRET')
  })

  test('uses a client secret locally', async () => {
    const get = config.get.bind(config)
    vi.spyOn(config, 'get').mockImplementation((key) => {
      if (key === 'auth.entraId.credentialType') return 'secret'
      if (key === 'auth.entraId.clientSecret') return 'local-secret'
      return get(key)
    })

    const provider = entraIdAuthProvider()
    expect(provider.type).toBe('client_secret')
    await expect(provider.getCredentials()).resolves.toBe('local-secret')
  })

  test('builds a session user shaped like the B2C one, with roles from the access token', () => {
    const user = createEntraUserSession({
      accessToken: jwt({ roles: ['Waste.Regulator.Standard'] }),
      refreshToken: 'r',
      claims: { oid: 'oid-1', sub: 's', name: 'Jo', preferred_username: 'jo@x' }
    })

    expect(user.profile).toEqual({
      oid: 'oid-1',
      entraOid: 'oid-1',
      sub: 's',
      name: 'Jo',
      email: 'jo@x',
      roles: ['Waste.Regulator.Standard']
    })
    expect(user.token).toBeTruthy()
  })

  test('keeps the old refresh token when Entra ID sends none', () => {
    const updated = updateEntraUserSession(
      { token: 'old', refreshToken: 'keep', profile: {} },
      { accessToken: 'new' }
    )
    expect(updated).toMatchObject({ token: 'new', refreshToken: 'keep' })
  })

  test('the account id comes from the configured claim', () => {
    const get = config.get.bind(config)
    vi.spyOn(config, 'get').mockImplementation((key) =>
      key === 'auth.entraId.accountIdClaim'
        ? 'extension_LegacyB2cOid'
        : get(key)
    )
    const user = createEntraUserSession({
      accessToken: jwt({}),
      refreshToken: 'r',
      claims: {
        oid: 'entra-oid',
        extension_LegacyB2cOid: 'a586e22f-0df0-4a24-8048-ae7d0aabbbbc'
      }
    })
    expect(user.profile.oid).toBe('a586e22f-0df0-4a24-8048-ae7d0aabbbbc')
    expect(user.profile.entraOid).toBe('entra-oid')
  })

  test('a required role is checked against the roles in the token', () => {
    const get = config.get.bind(config)
    vi.spyOn(config, 'get').mockImplementation((key) =>
      key === 'auth.entraId.requiredRole'
        ? 'Waste.Regulator.Standard'
        : get(key)
    )
    expect(
      hasRequiredEntraRole({ profile: { roles: ['Waste.Regulator.Standard'] } })
    ).toBe(true)
    expect(hasRequiredEntraRole({ profile: { roles: ['Other'] } })).toBe(false)
    expect(hasRequiredEntraRole({ profile: {} })).toBe(false)
  })

  test('no role is required unless one is configured', () => {
    expect(hasRequiredEntraRole({ profile: { roles: [] } })).toBe(true)
  })

  test('behind a path prefix the callback and sign-out URLs keep the prefix', () => {
    const get = config.get.bind(config)
    vi.spyOn(config, 'get').mockImplementation((key) =>
      key === 'auth.entraId'
        ? { ...get(key), externalBaseUrl: 'https://host.test/prefix/' }
        : get(key)
    )
    expect(entraExternalUrls()).toEqual({
      origin: 'https://host.test',
      callbackPath: '/prefix/signin-oidc',
      signedOutUrl: 'https://host.test/prefix/signed-out'
    })
  })

  test('falls back to the Entra oid when the user has no value in the configured claim', () => {
    const get = config.get.bind(config)
    vi.spyOn(config, 'get').mockImplementation((key) =>
      key === 'auth.entraId.accountIdClaim'
        ? 'extension_LegacyB2cOid'
        : get(key)
    )
    const user = createEntraUserSession({
      accessToken: jwt({}),
      refreshToken: 'r',
      claims: { oid: 'entra-oid' }
    })
    expect(user.profile.oid).toBe('entra-oid')
  })

  test('an empty or malformed value in the account id claim is ignored in favour of the oid', () => {
    const get = config.get.bind(config)
    vi.spyOn(config, 'get').mockImplementation((key) =>
      key === 'auth.entraId.accountIdClaim'
        ? 'extension_LegacyB2cOid'
        : get(key)
    )
    for (const value of ['', 'not-a-guid', 123, null]) {
      const user = createEntraUserSession({
        accessToken: jwt({}),
        refreshToken: 'r',
        claims: { oid: 'entra-oid', extension_LegacyB2cOid: value }
      })
      expect(user.profile.oid).toBe('entra-oid')
    }
  })

  test('a roles value that is not an array does not satisfy a required role', () => {
    const get = config.get.bind(config)
    vi.spyOn(config, 'get').mockImplementation((key) =>
      key === 'auth.entraId.requiredRole'
        ? 'Waste.Regulator.Standard'
        : get(key)
    )
    expect(
      hasRequiredEntraRole({
        profile: { roles: 'Waste.Regulator.Standard.ReadOnly' }
      })
    ).toBe(false)
  })

  test('a refresh that leaves out the roles claim leaves the user with no roles', () => {
    const updated = updateEntraUserSession(
      { token: 'old', profile: { roles: ['A'] } },
      { accessToken: jwt({}) }
    )
    expect(updated.profile.roles).toEqual([])
  })

  test('a client secret is not accepted on CDP', () => {
    const get = config.get.bind(config)
    vi.spyOn(config, 'get').mockImplementation((key) => {
      if (key === 'isProduction') return true
      if (key === 'auth.entraId.credentialType') return 'secret'
      return get(key)
    })
    expect(missingEntraIdSettings().join(' ')).toContain('must be federated')
  })

  test('a base URL that is not a URL counts as missing', () => {
    const get = config.get.bind(config)
    vi.spyOn(config, 'get').mockImplementation((key) =>
      key === 'auth.entraId'
        ? { ...get(key), externalBaseUrl: 'localhost:7154' }
        : get(key)
    )
    expect(missingEntraIdSettings()).toContain('ENTRA_ID_EXTERNAL_BASE_URL')
  })

  test('a trailing slash on the authority does not double up in the discovery URL', () => {
    const get = config.get.bind(config)
    vi.spyOn(config, 'get').mockImplementation((key) =>
      key === 'auth.entraId.authority' ? 'https://login.test/tenant/' : get(key)
    )
    expect(entraIdDiscoveryUri()).toBe(
      'https://login.test/tenant/v2.0/.well-known/openid-configuration'
    )
  })

  test('an authority that is not a URL counts as missing', () => {
    const get = config.get.bind(config)
    vi.spyOn(config, 'get').mockImplementation((key) =>
      key === 'auth.entraId'
        ? { ...get(key), authority: 'login.microsoftonline.com/tenant' }
        : get(key)
    )
    expect(missingEntraIdSettings().join(' ')).toContain('ENTRA_ID_AUTHORITY')
  })

  test('there is no Entra sign-out URL when the base URL is not a URL', () => {
    const get = config.get.bind(config)
    vi.spyOn(config, 'get').mockImplementation((key) => {
      if (key === 'auth.entraId.authority') return 'https://login.test/tenant'
      if (key === 'auth.entraId.externalBaseUrl') return 'localhost:7154'
      return get(key)
    })
    expect(entraSignOutUrl()).toBeNull()
  })

  test('there is no Entra sign-out URL when the authority is not a URL', () => {
    const get = config.get.bind(config)
    vi.spyOn(config, 'get').mockImplementation((key) => {
      if (key === 'auth.entraId.authority') {
        return 'login.microsoftonline.com/tenant'
      }
      if (key === 'auth.entraId.externalBaseUrl') return 'http://localhost:7154'
      return get(key)
    })
    expect(entraSignOutUrl()).toBeNull()
  })
})
