import { getSessionUser } from '../../../server/common/helpers/get-session-user.js'
import { config } from '../../config.js'

export function buildAccountNavigation(request) {
  const accountDetails = request.app?.accountDetails

  if (accountDetails?.organisationName) {
    return [{ text: accountDetails.organisationName }]
  }

  return []
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
  const user = getSessionUser(request)
  const accountDetails = request.app?.accountDetails

  if (user) {
    let html = '<p class="defra-internal-service-navigation__context">'
    if (accountDetails?.firstName && accountDetails?.lastName) {
      html += `${accountDetails.firstName} ${accountDetails.lastName} &nbsp;|&nbsp; `
    }
    html += `<a class="govuk-service-navigation__link" href="/logout">Sign out</a></p>`
    return html
  }

  return `<p class="defra-internal-service-navigation__context">
    <a class="govuk-service-navigation__link" href="/signin-oidc">Sign in</a>
  </p>`
}
