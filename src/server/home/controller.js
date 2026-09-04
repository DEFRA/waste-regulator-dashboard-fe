import Boom from '@hapi/boom'
import { config } from '../../config/config.js'
import { isRegulator, isRegulatorAdmin } from '../auth/regulator-access.js'
import { loadAccountDetails } from '../common/helpers/load-account-details.js'
import { getLocale } from '../common/helpers/i18n/get-locale.js'
import {
  persistAuthLocale,
  redirectWithLocale
} from '../common/helpers/i18n/locale-url.js'
import { pageI18n } from '../common/helpers/i18n/translate.js'

export const homeController = {
  async handler(request, h) {
    const locale = getLocale(request)
    const { user, accountDetails, accountDetailsError } =
      await loadAccountDetails(request)

    if (!user) {
      persistAuthLocale(request, locale)
      request.yar.set('returnTo', request.url.pathname + request.url.search)
      return redirectWithLocale(h, request, '/signin-oidc')
    }

    if (!isRegulator(accountDetails)) {
      return Boom.forbidden('User does not hold a regulator service role')
    }

    const i18n = pageI18n(locale, 'home')

    return h.view('home/index', {
      pageTitle: i18n.t('pageTitle'),
      heading: i18n.t('heading'),
      user,
      accountDetails,
      accountDetailsError,
      isRegulatorAdmin: isRegulatorAdmin(accountDetails),
      azureBaseUrl: config.get('services.regulatorAzure.baseUrl'),
      certificateOfComplianceBaseUrl: config.get(
        'services.certificateOfCompliance.baseUrl'
      ),
      homeI18n: i18n
    })
  }
}
