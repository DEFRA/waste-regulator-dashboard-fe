import Boom from '@hapi/boom'
import { config } from '../../config/config.js'
import {
  buildB2cLogoutUrl,
  getB2cAuthorityPrefix,
  resolvePostLogoutAbsoluteUri
} from '../auth/azure-ad-b2c.js'

import { resetAuthSession } from '../auth/reset-auth-session.js'
import {
  b2cErrorDetails,
  classifySigninFailure
} from '../auth/signin-callback-failure.js'
import { buildSiblingLogoutRedirectUrl } from '../auth/sibling-logout-redirect.js'
import { getSessionUser } from '../common/helpers/get-session-user.js'
import { getLocale } from '../common/helpers/i18n/get-locale.js'
import {
  clearAuthLocale,
  localeUrl,
  redirectWithLocale
} from '../common/helpers/i18n/locale-url.js'
import { translate } from '../common/helpers/i18n/translate.js'
import { withForwardedPrefix } from '../common/helpers/proxy/forwarded-prefix.js'
import { getAccountUserIdFromSessionUser } from '../common/services/account-api.service.js'

const SIGN_IN_FAILED_PATH = '/sign-in-failed'

function redirectToReturnTo(request, h) {
  const returnTo = request.yar.get('returnTo') || '/home'
  request.yar.clear('returnTo')
  const response = redirectWithLocale(h, request, returnTo)
  clearAuthLocale(request)
  return response
}

/**
 * `/signin-oidc` runs Bell in `try` mode, so a callback Bell cannot complete —
 * cancelled at B2C, a stale or replayed `state`, an expired state cookie, a
 * failed code-for-token exchange — reaches this handler as `request.auth.error`.
 * Coming back to the callback with a `state` Bell has already spent (a reload,
 * or Back to B2C's sign-in page after signing in) is one of these.
 *
 * The person is redirected to the sign-in-failed page (Post/Redirect/Get), so
 * the code and state leave the address bar and reloading that page does not
 * replay the callback. Nothing here sends them back into sign-in by itself,
 * so a failure that repeats on every attempt cannot loop; they retry from the
 * page. `returnTo` and `authLocale` are kept so that retry lands where they
 * were going, in their language.
 */
function handleFailedSignin(request, h) {
  const reason = classifySigninFailure(request)
  request.logger.warn(
    { signIn: { reason, ...b2cErrorDetails(request) } },
    `Sign-in callback failed: ${reason}`
  )

  if (getSessionUser(request)) {
    return redirectToReturnTo(request, h)
  }
  return redirectWithLocale(h, request, SIGN_IN_FAILED_PATH)
}

export const signInFailedController = {
  handler(request, h) {
    const locale = getLocale(request)

    return h.view('regulators/sign-in-failed', {
      pageTitle: translate(locale, 'auth.signInFailed.pageTitle'),
      hideCookieBanner: true,
      tryAgainPrefix: translate(locale, 'auth.signInFailed.tryAgainPrefix'),
      tryAgainLinkText: translate(locale, 'auth.signInFailed.tryAgainLinkText'),
      tryAgainSuffix: translate(locale, 'auth.signInFailed.tryAgainSuffix'),
      tryAgainUrl: localeUrl(
        withForwardedPrefix(request, '/signin-oidc'),
        locale
      )
    })
  }
}

export const signinOidcController = {
  handler(request, h) {
    // In `try` mode Bell passes partial credentials even when it fails, so
    // they are only stored once it has actually authenticated.
    if (!request.auth?.isAuthenticated) {
      return handleFailedSignin(request, h)
    }

    // OpenID Connect requires an id_token in this token response, and the
    // user id is read from it. Without one, B2C or our configuration is at
    // fault, not the person, so this is a 500 rather than a sign-in to retry
    // or a 403 on the next page.
    if (!getAccountUserIdFromSessionUser(request.auth.credentials)) {
      // B2C has signed someone in, so the service is left signed in as
      // nobody, not as whoever this browser signed in as before.
      request.yar.clear('user')
      return Boom.internal(
        'B2C sign-in returned no usable user id (oid or sub)'
      )
    }

    request.yar.set('user', request.auth.credentials)
    return redirectToReturnTo(request, h)
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
