import { config } from '../../../config/config.js'
import { statusCodes } from '../constants/status-codes.js'
import { getLocale } from './i18n/get-locale.js'
import { translate } from './i18n/translate.js'

const errorPages = {
  [statusCodes.notFound]: {
    view: 'error/not-found',
    pageTitleKey: 'errors.notFound.pageTitle'
  },
  [statusCodes.forbidden]: {
    view: 'error/access-denied',
    pageTitleKey: 'errors.accessDenied.pageTitle'
  },
  [statusCodes.serviceUnavailable]: {
    view: 'error/service-unavailable',
    pageTitleKey: 'errors.serviceUnavailable.pageTitle'
  }
}

const problemWithServicePage = {
  view: 'error/problem-with-service',
  pageTitleKey: 'errors.problemWithService.pageTitle'
}

export function errorPageFor(statusCode) {
  return errorPages[statusCode] ?? problemWithServicePage
}

export function errorPageTitle(statusCode, locale = 'en') {
  const { pageTitleKey } = errorPageFor(statusCode)
  return translate(locale, pageTitleKey)
}

/**
 * Renders the error page for a status code. Shared with the maintenance plugin
 * so a shuttered service and a Boom 503 produce the same page.
 */
export function renderErrorPage(h, statusCode, request) {
  const locale = request ? getLocale(request) : 'en'
  const { view, pageTitleKey } = errorPageFor(statusCode)

  return h
    .view(view, {
      pageTitle: translate(locale, pageTitleKey),
      locale,
      availableFrom: config.get('maintenance.availableFrom')
    })
    .code(statusCode)
}

export function catchAll(request, h) {
  const { response } = request

  if (!('isBoom' in response)) {
    return h.continue
  }

  const statusCode = response.output.statusCode

  if (statusCode >= statusCodes.internalServerError) {
    request.logger.error(response?.stack)
  }

  return renderErrorPage(h, statusCode, request)
}
