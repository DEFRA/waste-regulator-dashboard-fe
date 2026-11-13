import { isEntraIdConfigured, isEntraProvider } from '../auth/entra-id.js'
import {
  entraNotConfiguredController,
  entraSigninController,
  signinOidcController,
  signInFailedController,
  signOutController,
  signedOutController,
  whoamiController
} from './controller.js'
import { SESSION_USER_STRATEGY } from '../auth/session-user.js'

export const regulators = {
  plugin: {
    name: 'regulators',
    register(server) {
      server.route([
        isEntraProvider()
          ? {
              method: 'GET',
              path: '/signin-oidc',
              options: {
                auth: false,
                ...(isEntraIdConfigured()
                  ? entraSigninController
                  : entraNotConfiguredController)
              }
            }
          : {
              method: ['GET', 'POST'],
              path: '/signin-oidc',
              options: {
                // `try`, not the default `required`: when Bell cannot complete
                // the callback it hands the handler `request.auth.error` instead
                // of answering with a 500 of its own.
                auth: { strategy: 'azure-ad-b2c', mode: 'try' },
                ...signinOidcController
              }
            },
        ...(isEntraProvider() && isEntraIdConfigured()
          ? [
              {
                method: 'GET',
                path: '/whoami',
                options: { auth: SESSION_USER_STRATEGY, ...whoamiController }
              }
            ]
          : []),
        {
          method: 'GET',
          path: '/sign-in-failed',
          options: {
            auth: false,
            ...signInFailedController
          }
        },
        {
          method: 'GET',
          path: '/logout',
          options: {
            auth: false,
            ...signOutController
          }
        },
        {
          method: 'GET',
          path: '/signed-out',
          options: {
            auth: false,
            ...signedOutController
          }
        }
      ])
    }
  }
}
