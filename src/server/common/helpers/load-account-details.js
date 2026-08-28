import { config } from '../../../config/config.js'
import { getSessionUser } from './get-session-user.js'
import {
  createAccountApiService,
  getAccountUserIdFromSessionUser,
  mapAccountDetailsDtoToViewModel
} from '../services/account-api.service.js'

export async function loadAccountDetails(request) {
  const user = getSessionUser(request)
  if (!user) {
    return {
      user: undefined,
      accountDetails: undefined,
      accountDetailsError: undefined
    }
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

  request.app = request.app || {}
  request.app.accountDetails = accountDetails

  return { user, accountDetails, accountDetailsError }
}
