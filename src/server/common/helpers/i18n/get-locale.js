import { createLogger } from '../logging/logger.js'
import {
  DEFAULT_LOCALE,
  isSupportedLocale,
  normaliseLocale
} from './locales.js'

const logger = createLogger('get-locale')

export function getLocale(request) {
  const queryLocale = normaliseLocale(request?.query?.lang)

  if (isSupportedLocale(queryLocale)) {
    return queryLocale
  }

  try {
    const sessionLocale = normaliseLocale(request?.yar?.get('authLocale'))

    if (isSupportedLocale(sessionLocale)) {
      return sessionLocale
    }
  } catch (error) {
    logger.warn({ err: error }, 'Failed to read authLocale from session')
  }

  const headerLocale = normaliseLocale(
    request?.headers?.['accept-language']?.split(',')[0]
  )

  if (isSupportedLocale(headerLocale)) {
    return headerLocale
  }

  return DEFAULT_LOCALE
}
