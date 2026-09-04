import { config } from '../../config/config.js'
import {
  BELL_AZURE_AD_B2C_COOKIE,
  buildB2cLogoutUrl,
  getB2cAuthorityPrefix,
  resolvePostLogoutAbsoluteUri
} from '../auth/azure-ad-b2c.js'
import { getLocale } from '../common/helpers/i18n/get-locale.js'
import {
  clearAuthLocale,
  redirectWithLocale
} from '../common/helpers/i18n/locale-url.js'
import { translate } from '../common/helpers/i18n/translate.js'

export const signinOidcController = {
  handler(request, h) {
    if (request.auth?.credentials) {
      request.yar.set('user', request.auth.credentials)
    }
    const returnTo = request.yar.get('returnTo') || '/'
    request.yar.clear('returnTo')
    const response = redirectWithLocale(h, request, returnTo)
    clearAuthLocale(request)
    return response
  }
}

export const signOutController = {
  handler(request, h) {
    if (request.yar) {
      request.yar.reset()
    }
    h.unstate(BELL_AZURE_AD_B2C_COOKIE)

    const azure = config.get('auth.azureAdB2c')
    const prefix = getB2cAuthorityPrefix(azure)
    const pathOrUrl = azure.postLogoutRedirectPath || '/signed-out'
    const postLogoutUri = resolvePostLogoutAbsoluteUri(
      request,
      pathOrUrl,
      azure
    )

    if (!prefix) {
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
