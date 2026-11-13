import { hapiAuthOidcPlugin } from '@defra/hapi-auth-oidc'

import { config } from '../../config/config.js'
import {
  entraIdAuthProvider,
  entraIdDiscoveryUri,
  entraExternalUrls,
  entraIdScopes,
  hasRequiredEntraRole,
  isEntraIdConfigured,
  isEntraProvider,
  missingEntraIdSettings,
  updateEntraUserSession
} from '../auth/entra-id.js'
import { getSessionUser } from '../common/helpers/get-session-user.js'

const REFRESH_BEFORE_EXPIRY_MS = 5 * 60 * 1000
const OUTBOUND_TIMEOUT_SECONDS = 20

async function refreshEntraTokens(request, h) {
  const user = getSessionUser(request)

  if (!user || !request.ensureValidToken) {
    return h.continue
  }

  try {
    const { token, refreshed } = await request.ensureValidToken({
      accessToken: user.token,
      refreshToken: user.refreshToken
    })
    if (refreshed) {
      const updated = updateEntraUserSession(user, token)
      if (hasRequiredEntraRole(updated)) {
        request.yar.set('user', updated)
      } else {
        request.yar.clear('user')
      }
    }
  } catch (error) {
    request.logger?.warn(
      error,
      'Signing user out, Entra ID token refresh failed'
    )
    request.yar.clear('user')
  }

  return h.continue
}

export const entraAuth = {
  plugin: {
    name: 'entra-auth',
    async register(server) {
      if (!isEntraProvider()) {
        return
      }

      if (!isEntraIdConfigured()) {
        server.logger.warn(
          `Entra ID is not configured, sign-in will not work until these are set: ${missingEntraIdSettings().join(', ')}`
        )
        return
      }

      server.ext('onPreAuth', refreshEntraTokens)

      await server.register({
        plugin: hapiAuthOidcPlugin,
        options: {
          oidc: {
            discoveryUri: entraIdDiscoveryUri(),
            clientId: config.get('auth.entraId.clientId'),
            authProvider: entraIdAuthProvider(),
            scope: entraIdScopes().join(' '),
            loginCallbackUri: entraExternalUrls().callbackPath,
            responseMode: 'query',
            externalBaseUrl: entraExternalUrls().origin,
            earlyRefreshMs: REFRESH_BEFORE_EXPIRY_MS,
            discoveryRequestOptions: { timeout: OUTBOUND_TIMEOUT_SECONDS }
          },
          cookieOptions: {
            password: config.get('auth.azureAdB2c.cookiePassword'),
            isSecure: config.get('auth.azureAdB2c.isSecure'),
            isSameSite: 'Lax'
          }
        }
      })
    }
  }
}
