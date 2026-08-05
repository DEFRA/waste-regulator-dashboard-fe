import { getSessionUser } from '../../../server/common/helpers/get-session-user.js'

export function buildNavigation(request) {
  const user = getSessionUser(request)

  if (user) {
    return [{ text: 'Sign out', href: '/logout' }]
  }

  return [{ text: 'Sign in', href: '/signin-oidc' }]
}
