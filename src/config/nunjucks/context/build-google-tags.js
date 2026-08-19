import { config } from '../../config.js'
import { createLogger } from '../../../server/common/helpers/logging/logger.js'

const logger = createLogger('build-google-tags')

export function buildGoogleTags(request) {
  let allowGoogleAnalytics = true

  try {
    const policy = request?.state?.cookies_policy
    if (policy) {
      const parsed = typeof policy === 'string' ? JSON.parse(policy) : policy
      allowGoogleAnalytics = !!parsed.usage
    }
  } catch (err) {
    logger.error('Failed to parse cookies_policy from request state', err)
  }

  return {
    allowGoogleAnalytics,
    ga: {
      id: config.get('googleAnalytics.id'),
      tag: config.get('googleAnalytics.tag')
    }
  }
}
