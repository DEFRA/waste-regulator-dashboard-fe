import { getSessionUser } from '../../../server/common/helpers/get-session-user.js'

export function buildNavigation(request) {
  const user = getSessionUser(request)
  const accountDetails = request.app?.accountDetails

  if (user) {
    if (accountDetails && accountDetails.firstName && accountDetails.lastName) {
      return [
        { text: accountDetails.firstName + ' ' + accountDetails.lastName },
        { text: 'Sign out', href: '/logout' }
      ]
    }

    return [{ text: 'Sign out', href: '/logout' }]
  }

  return [{ text: 'Sign in', href: '/signin-oidc' }]
}
