import { homeController } from './controller.js'
import { SESSION_USER_STRATEGY } from '../auth/session-user.js'
import { requireRegulatorRole } from '../auth/regulator-access.js'

/**
 * Sets up the routes used in the home page.
 * These routes are registered in src/server/router.js.
 */
export const home = {
  plugin: {
    name: 'home',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/home',
          options: {
            auth: SESSION_USER_STRATEGY,
            pre: [requireRegulatorRole],
            ...homeController
          }
        }
      ])
    }
  }
}
