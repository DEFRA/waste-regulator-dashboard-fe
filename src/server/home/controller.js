import { config } from '../../config/config.js'
import { getSessionUser } from '../common/helpers/get-session-user.js'
import {
  createAccountApiService,
  getAccountUserIdFromSessionUser,
  mapAccountDetailsDtoToViewModel
} from '../common/services/account-api.service.js'

export const homeController = {
  async handler(request, h) {
    const user = getSessionUser(request)
    if (!user) {
      return h.redirect('/signin-oidc')
    }

    let accountDetails
    let accountDetailsError
    const userId = getAccountUserIdFromSessionUser(user)

    if (userId) {
      try {
        const accountApi = createAccountApiService({
          logger: request.logger
        })
        const dto = await accountApi.getAccountDetails(
          userId,
          request.headers?.[config.get('tracing.header')]
        )
        accountDetails = mapAccountDetailsDtoToViewModel(dto)
        if (
          !accountDetails ||
          (accountDetails.firstName === '' &&
            accountDetails.lastName === '' &&
            accountDetails.organisationName === '' &&
            accountDetails.nationId === undefined &&
            accountDetails.serviceRoleId === undefined)
        ) {
          accountDetails = undefined
          accountDetailsError = 'We could not load your account details.'
        }
      } catch (err) {
        request.logger?.error({ err }, 'Failed to load account details')
        accountDetailsError = 'We could not load your account details.'
      }
    } else {
      accountDetailsError = 'We could not determine your user id.'
    }

    request.app.accountDetails = accountDetails

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
