import { config } from '../../config/config.js'
import { loadAccountDetails } from '../common/helpers/load-account-details.js'

export const homeController = {
  async handler(request, h) {
    const { user, accountDetails, accountDetailsError } =
      await loadAccountDetails(request)

    if (!user) {
      return h.redirect('/signin-oidc')
    }

    return h.view('home/index', {
      pageTitle: "pEPR: Regulators' Service  - GOV.UK",
      heading: "pEPR: Regulators' Service",
      user,
      accountDetails,
      accountDetailsError,
      azureBaseUrl: config.get('services.regulatorAzure.baseUrl'),
      certificateOfComplianceBaseUrl: config.get(
        'services.certificateOfCompliance.baseUrl'
      )
    })
  }
}
