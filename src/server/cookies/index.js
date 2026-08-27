import { cookiesController } from './controller.js'

export const cookies = {
  plugin: {
    name: 'cookies',
    register(server) {
      server.route([
        {
          method: 'GET',
          path: '/cookies',
          handler: cookiesController.getHandler
        },
        {
          method: 'POST',
          path: '/cookies',
          handler: cookiesController.postHandler
        },
        {
          method: 'POST',
          path: '/cookies/banner',
          handler: cookiesController.bannerPostHandler
        },
        {
          method: 'POST',
          path: '/cookies/hide-banner',
          handler: cookiesController.hideBannerPostHandler
        }
      ])
    }
  }
}
