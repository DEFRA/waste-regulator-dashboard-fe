import { homeController } from './controller.js'
import { regulatorRouteOptions } from '../auth/regulator-access.js'

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
            ...regulatorRouteOptions,
            ...homeController
          }
        }
      ])
    }
  }
}
