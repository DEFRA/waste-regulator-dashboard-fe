import { config } from '../../../config/config.js'

const USER_COOKIE_NAME = config.get('userCookie.name')

/**
 * Read the authenticated user from the short-lived user cookie.
 * Returns null when the cookie is absent or has expired.
 *
 * @param {import('@hapi/hapi').Request} request
 * @returns {object|null}
 */
export function getSessionUser(request) {
  return request.state?.[USER_COOKIE_NAME] ?? null
}
