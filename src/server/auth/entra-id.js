import { WebIdentityTokenProvider } from '@defra/hapi-auth-oidc'

import { config } from '../../config/config.js'

const WEB_IDENTITY_TOKEN_EARLY_REFRESH_MS = 60 * 1000

export const AUTH_PROVIDER_ENTRA = 'entra'

export const entraIdSettings = {
  authority: 'ENTRA_ID_AUTHORITY',
  clientId: 'ENTRA_ID_CLIENT_ID',
  clientSecret: 'ENTRA_ID_CLIENT_SECRET',
  apiScope: 'ENTRA_ID_API_SCOPE'
}

export function isEntraProvider() {
  return config.get('auth.provider') === AUTH_PROVIDER_ENTRA
}

function usesFederatedCredential() {
  return config.get('auth.entraId.credentialType') === 'federated'
}

export function missingEntraIdSettings() {
  const entraId = config.get('auth.entraId')
  return Object.entries(entraIdSettings)
    .filter(([key]) => key !== 'clientSecret' || !usesFederatedCredential())
    .filter(([key]) => !entraId[key])
    .map(([, envVar]) => envVar)
    .concat(
      entraId.authority && !isValidUrl(entraId.authority)
        ? ['ENTRA_ID_AUTHORITY (must be a URL)']
        : []
    )
    .concat(missingExternalBaseUrl(entraId))
    .concat(secretOnCdp())
}

// No client secret on CDP: federation is required there
function secretOnCdp() {
  return config.get('isProduction') && !usesFederatedCredential()
    ? ['ENTRA_ID_CREDENTIAL_TYPE (must be federated on CDP)']
    : []
}

// The default is the local URL. On CDP it would send Entra ID a localhost
// redirect URI without any warning.
function isValidUrl(value) {
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol)
  } catch {
    return false
  }
}

function missingExternalBaseUrl(entraId) {
  const unset =
    !isValidUrl(entraId.externalBaseUrl) ||
    (config.get('isProduction') &&
      entraId.externalBaseUrl ===
        config.default('auth.entraId.externalBaseUrl'))
  return unset ? ['ENTRA_ID_EXTERNAL_BASE_URL'] : []
}

export function isEntraIdConfigured() {
  return missingEntraIdSettings().length === 0
}

export function entraIdAuthProvider() {
  if (usesFederatedCredential()) {
    return new WebIdentityTokenProvider({
      audience: [config.get('auth.entraId.federatedCredentialsAudience')],
      earlyRefreshMs: WEB_IDENTITY_TOKEN_EARLY_REFRESH_MS
    })
  }

  return {
    type: 'client_secret',
    getCredentials: async (_logger) => config.get('auth.entraId.clientSecret')
  }
}

function entraAuthority() {
  return config.get('auth.entraId.authority').replace(/\/+$/, '')
}

export function entraIdDiscoveryUri() {
  return `${entraAuthority()}/v2.0/.well-known/openid-configuration`
}

export function entraIdScopes() {
  return [
    'openid',
    'profile',
    'offline_access',
    config.get('auth.entraId.apiScope')
  ]
}

function decodeJwtPayload(token) {
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString())
  } catch {
    return {}
  }
}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * The configured claim, only if it holds a GUID; otherwise the Entra oid. The
 * claim decides whose account loads, so the attribute behind it must be
 * writable by admins only.
 */
function accountIdFrom(claims) {
  const value = claims[config.get('auth.entraId.accountIdClaim')]
  return typeof value === 'string' && GUID.test(value) ? value : claims.oid
}

/**
 * Same shape as the B2C session user (`token` and `profile.oid`), so account
 * lookups keep working, plus the roles from the access token.
 */
export function createEntraUserSession({ accessToken, refreshToken, claims }) {
  const accessClaims = decodeJwtPayload(accessToken)
  return {
    token: accessToken,
    refreshToken,
    profile: {
      // The id the Account API knows the user by: the configured claim (for
      // example the legacy B2C object id), or the Entra oid when it is absent
      oid: accountIdFrom(claims),
      entraOid: claims.oid,
      sub: claims.sub,
      name: claims.name ?? claims.preferred_username,
      email: claims.preferred_username,
      roles: accessClaims.roles ?? []
    }
  }
}

export function hasRequiredEntraRole(user) {
  const required = config.get('auth.entraId.requiredRole')
  const roles = user?.profile?.roles
  return !required || (Array.isArray(roles) && roles.includes(required))
}

export function updateEntraUserSession(user, token) {
  return {
    ...user,
    token: token.accessToken,
    refreshToken: token.refreshToken ?? user.refreshToken,
    profile: {
      ...user.profile,
      // Entra ID leaves the claim out when the user has no roles left
      roles: decodeJwtPayload(token.accessToken).roles ?? []
    }
  }
}

/**
 * The public origin, and the path the app is served under. The library builds
 * the redirect URI as new URL(loginCallbackUri, externalBaseUrl), which drops a
 * path in the base, so the path goes in front of the callback route instead.
 * Behind a path prefix, ENTRA_ID_EXTERNAL_BASE_URL is https://host/prefix.
 */
export function entraExternalUrls() {
  const { externalBaseUrl } = config.get('auth.entraId')
  const base = new URL(externalBaseUrl)
  const basePath = base.pathname.replace(/\/+$/, '')
  return {
    origin: base.origin,
    callbackPath: `${basePath}/signin-oidc`,
    signedOutUrl: new URL(`${basePath}/signed-out`, base.origin).href
  }
}

export function entraSignOutUrl() {
  if (
    !isValidUrl(entraAuthority()) ||
    !isValidUrl(config.get('auth.entraId.externalBaseUrl'))
  ) {
    return null
  }
  const url = new URL(`${entraAuthority()}/oauth2/v2.0/logout`)
  url.searchParams.set(
    'post_logout_redirect_uri',
    entraExternalUrls().signedOutUrl
  )
  return url.href
}
