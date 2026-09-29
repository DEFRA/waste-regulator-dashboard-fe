import { config } from '../../config/config.js'

/**
 * When the sibling CSOC app runs on a different origin (local dev), clearing
 * path-scoped cookies from the dashboard response cannot sign CSOC out. Redirect
 * the browser through CSOC /logout instead (top-level navigation sends cookies).
 *
 * @returns {boolean}
 */
export function shouldChainSiblingLogout() {
  if (!config.get('features.certificateOfCompliance')) {
    return false
  }

  const baseUrl = config.get('services.certificateOfCompliance.baseUrl')
  return /^https?:\/\//i.test(baseUrl)
}

/**
 * @param {string} returnToAbsoluteUrl - where CSOC should send the browser after logout
 * @returns {string|null}
 */
export function buildSiblingLogoutRedirectUrl(returnToAbsoluteUrl) {
  if (!shouldChainSiblingLogout()) {
    return null
  }

  const baseUrl = config.get('services.certificateOfCompliance.baseUrl')
  const url = new URL('/logout', baseUrl)
  url.searchParams.set('returnTo', returnToAbsoluteUrl)
  return url.href
}
