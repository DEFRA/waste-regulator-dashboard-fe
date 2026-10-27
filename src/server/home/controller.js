import { config } from '../../config/config.js'
import { isRegulatorAdmin } from '../auth/regulator-access.js'
import { getLocale } from '../common/helpers/i18n/get-locale.js'
import { pageI18n } from '../common/helpers/i18n/translate.js'

export const homeController = {
  handler(request, h) {
    const locale = getLocale(request)
    const { user } = request.auth.credentials
    const accountDetails = request.app?.accountDetails
    const accountDetailsError = request.app?.accountDetailsError
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
