import inert from '@hapi/inert'

import { config } from '../config/config.js'
import { home } from './home/index.js'
import { about } from './about/index.js'
import { cookies } from './cookies/index.js'
import { regulators } from './regulators/index.js'
import { health } from './health/index.js'
import { errorExamples } from './error/examples/index.js'
import { serveStaticFiles } from './common/helpers/serve-static-files.js'

export const router = {
  plugin: {
    name: 'router',
    async register(server) {
      await server.register([inert])

      // Health-check route. Used by platform to check if service is running, do not remove!
      await server.register([health])

      // Application specific routes, add your own routes here
      await server.register([home, about, cookies, regulators])

      // Error page previews for design and QA — never exposed in production
      if (!config.get('isProduction')) {
        await server.register([errorExamples])
      }

      // Static assets
      await server.register([serveStaticFiles])
    }
  }
}
