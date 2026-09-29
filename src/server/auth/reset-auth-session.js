import { config } from '../../config/config.js'
import { BELL_AZURE_AD_B2C_COOKIE } from './azure-ad-b2c.js'

/**
 * Revokes the server-side yar session and clears local auth cookies.
 * Do not call yar.reset() here — it creates a new session cookie on the response.
 *
 * @param {import('@hapi/hapi').Request} request
 * @param {import('@hapi/hapi').ResponseToolkit} h
 */
export function resetAuthSession(request, h) {
  const sessionId = request.yar?.id

  if (sessionId) {
    request.server.yar.revoke(sessionId)
  }

  h.unstate(BELL_AZURE_AD_B2C_COOKIE)
  h.unstate(config.get('session.cache.name'))
}
