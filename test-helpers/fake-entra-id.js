/**
 * A fake Entra ID, for tests. @defra/hapi-auth-oidc calls Entra ID with
 * fetch, so tests answer those calls with fakeEntraIdFetch.
 */
const authority = 'https://login.test/tenant-id'
const issuer = `${authority}/v2.0`

export const entraIdUrls = {
  discovery: `${issuer}/.well-known/openid-configuration`,
  authorize: `${authority}/oauth2/v2.0/authorize`,
  token: `${authority}/oauth2/v2.0/token`
}

export const testUser = {
  oid: 'user-object-id',
  name: 'Jo Bloggs'
}

/**
 * An unsigned JWT. The ID token comes straight from Entra ID's token
 * endpoint, so its signature isn't checked.
 */
export function fakeJwt(payload) {
  const encode = (value) =>
    Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode(payload)}.signature`
}

function nowInSeconds() {
  return Math.floor(Date.now() / 1000)
}

/**
 * @param {object} [options]
 * @param {string} [options.name] - the access token's name, to tell tokens apart
 * @param {number} [options.expiresIn] - seconds until the access token expires
 */
export function fakeAccessToken({ name = 'user', expiresIn = 3600 } = {}) {
  return fakeJwt({ name, exp: nowInSeconds() + expiresIn })
}

function discoveryResponse() {
  return Response.json({
    issuer,
    authorization_endpoint: entraIdUrls.authorize,
    token_endpoint: entraIdUrls.token,
    jwks_uri: `${authority}/discovery/v2.0/keys`,
    response_types_supported: ['code'],
    // Like Entra ID, doesn't list code_challenge_methods_supported, so
    // @defra/hapi-auth-oidc sends a nonce as well as using PKCE
    id_token_signing_alg_values_supported: ['RS256']
  })
}

function tokenResponse({ accessToken, refreshToken, claims }) {
  const now = nowInSeconds()

  return Response.json({
    token_type: 'Bearer',
    expires_in: 3600,
    access_token: accessToken,
    // Entra ID leaves the field out when it issues no refresh token
    ...(refreshToken ? { refresh_token: refreshToken } : {}),
    id_token: fakeJwt({
      iss: issuer,
      aud: 'frontend-client-id',
      sub: 'user-subject',
      iat: now,
      exp: now + 3600,
      ...testUser,
      ...claims
    })
  })
}

/**
 * Answers fetch calls to Entra ID's discovery and token endpoints.
 * @param {object} [options]
 * @param {string} [options.accessToken]
 * @param {string} [options.refreshToken]
 * @param {object} [options.claims] - extra ID token claims
 * @param {Response} [options.tokenError] - send this from the token endpoint instead
 */
export function fakeEntraIdFetch({
  accessToken = fakeAccessToken(),
  refreshToken = 'user-refresh-token',
  claims = {},
  tokenError
} = {}) {
  return async (url) => {
    const href = String(url)

    if (href === entraIdUrls.discovery) {
      return discoveryResponse()
    }

    if (href === entraIdUrls.token) {
      return tokenError ?? tokenResponse({ accessToken, refreshToken, claims })
    }

    throw new Error(`Fake Entra ID doesn't handle ${href}`)
  }
}
