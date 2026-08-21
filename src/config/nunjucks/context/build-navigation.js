import { getSessionUser } from '../../../server/common/helpers/get-session-user.js'
import { config } from '../../config.js'

export function buildAccountNavigation(request) {
  const user = getSessionUser(request)
  const accountDetails = request.app?.accountDetails

  if (accountDetails) {
    return [
      { text: accountDetails.firstName + ' ' + accountDetails.lastName },
      { text: 'Sign out', href: '/logout' }
    ]
  } else if (user) {
    return [{ text: 'Sign out', href: '/logout' }]
  }

  return [{ text: 'Sign in', href: '/signin-oidc' }]
}

export function buildNavigation(request) {
  const user = getSessionUser(request)
  const azureBaseUrl = config.get('services.regulatorAzure.baseUrl')

  if (user) {
    return [
      {
        href: azureBaseUrl + '/regulators/manage-account/manage',
        text: 'Manage account'
      }
    ]
  }

  return []
}

export function buildRegulatorContext(request) {
  const accountDetails = request.app?.accountDetails

  if (accountDetails?.organisationName) {
    return `<p class="defra-internal-service-navigation__context">${accountDetails.organisationName}</p>`
  }

  return undefined
}
