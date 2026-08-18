import { config } from '../../config.js'

export function buildGoogleTags(request) {
  let allowGoogleAnalytics = true

  try {
    const policy = request?.state?.cookies_policy
    if (policy) {
      const parsed = typeof policy === 'string' ? JSON.parse(policy) : policy
      allowGoogleAnalytics = !!parsed.usage
    }
  } catch (err) {
    // Ignore JSON parse errors
  }

  if (config.get('isProduction')) {
    return {
      allowGoogleAnalytics,
      ga: {
        id: null,
        tag: null
      }
    }
  }

  return {
    allowGoogleAnalytics,
   ga: {
      id: 'G-9YS32BSK6B',
      tag: 'GTM-NBWSJJF2'
    }
  }
}
