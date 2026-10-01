import { config } from '../../config/config.js'
import {
  buildB2cLogoutUrl,
  getB2cAuthorityPrefix,
  resolvePostLogoutAbsoluteUri
} from '../auth/azure-ad-b2c.js'
import { resetAuthSession } from '../auth/reset-auth-session.js'
import { buildSiblingLogoutRedirectUrl } from '../auth/sibling-logout-redirect.js'
import { getLocale } from '../common/helpers/i18n/get-locale.js'
import {
  clearAuthLocale,
  redirectWithLocale
} from '../common/helpers/i18n/locale-url.js'
import { translate } from '../common/helpers/i18n/translate.js'

const USER_COOKIE_NAME = config.get('userCookie.name')

export const signinOidcController = {
  handler(request, h) {
    if (request.auth?.credentials) {
      request.yar.set('user', request.auth.credentials)
    }
    const returnTo = request.yar.get('returnTo') || '/home'
    request.yar.clear('returnTo')
    const response = redirectWithLocale(h, request, returnTo)
    clearAuthLocale(request)
    return response
  }
}

export const signOutController = {
  handler(request, h) {
    resetAuthSession(request, h)

    const azure = config.get('auth.azureAdB2c')
    const prefix = getB2cAuthorityPrefix(azure)
    const pathOrUrl = azure.postLogoutRedirectPath || '/signed-out'
    const postLogoutUri = resolvePostLogoutAbsoluteUri(
      request,
      pathOrUrl,
      azure
    )

    const siblingLogoutUrl = buildSiblingLogoutRedirectUrl(postLogoutUri)
    if (siblingLogoutUrl) {
      return h.redirect(siblingLogoutUrl)
    }

    if (config.get('useMockAuth') || !prefix) {
      return redirectWithLocale(h, request, '/signed-out')
    }
    return h.redirect(buildB2cLogoutUrl(prefix, postLogoutUri))
  }
}

export const signedOutController = {
  handler(request, h) {
    const locale = getLocale(request)

    return h.view('regulators/signed-out', {
      pageTitle: translate(locale, 'auth.signedOut.pageTitle'),
      heading: translate(locale, 'auth.signedOut.heading'),
      message: translate(locale, 'auth.signedOut.message')
    })
  }
}
