import { config } from '../../config/config.js'

function isAbsoluteHttpUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value)
}

function getUrlOrigin(value) {
  try {
    return new URL(value).origin
  } catch {
    return null
  }
}

/**
 * When the sibling CSOC app runs on a different origin (local dev), clearing
 * path-scoped cookies from the dashboard response cannot sign CSOC out. Redirect
 * the browser through CSOC /logout instead (top-level navigation sends cookies).
 *
 * On a shared reverse proxy (same host, different path prefixes), sibling cookie
 * clearing on the dashboard response is sufficient — do not chain.
 *
 * @param {string} [returnToAbsoluteUrl]
 * @returns {boolean}
 */
export function shouldChainSiblingLogout(returnToAbsoluteUrl) {
  if (!config.get('features.certificateOfCompliance')) {
    return false
  }

  const baseUrl = config.get('services.certificateOfCompliance.baseUrl')
  if (!isAbsoluteHttpUrl(baseUrl)) {
    return false
  }

  if (isAbsoluteHttpUrl(returnToAbsoluteUrl)) {
    const csocOrigin = getUrlOrigin(baseUrl)
    const returnToOrigin = getUrlOrigin(returnToAbsoluteUrl)
    if (csocOrigin && returnToOrigin) {
      return csocOrigin !== returnToOrigin
    }
  }

  return true
}

/**
 * @param {string} returnToAbsoluteUrl - where CSOC should send the browser after logout
 * @returns {string|null}
 */
export function buildSiblingLogoutRedirectUrl(returnToAbsoluteUrl) {
  if (!shouldChainSiblingLogout(returnToAbsoluteUrl)) {
    return null
  }

  const baseUrl = config.get('services.certificateOfCompliance.baseUrl')
  const base = new URL(baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`)
  const url = new URL('logout', base)
  url.searchParams.set('returnTo', returnToAbsoluteUrl)
  return url.href
}
