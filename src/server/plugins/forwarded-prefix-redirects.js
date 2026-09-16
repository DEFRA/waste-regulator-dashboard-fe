import { withForwardedPrefix } from '../common/helpers/proxy/forwarded-prefix.js'

const FIRST_REDIRECT_STATUS_CODE = 300
const FIRST_CLIENT_ERROR_STATUS_CODE = 400

export const forwardedPrefixRedirects = {
  plugin: {
    name: 'forwarded-prefix-redirects',
    register(server) {
      server.ext('onPreResponse', (request, h) => {
        const response = request.response
        const location = response?.headers?.location

        if (
          response?.isBoom ||
          !location ||
          response.statusCode < FIRST_REDIRECT_STATUS_CODE ||
          response.statusCode >= FIRST_CLIENT_ERROR_STATUS_CODE
        ) {
          return h.continue
        }

        const externalLocation = withForwardedPrefix(request, location)

        if (externalLocation !== location) {
          response.header('location', externalLocation)
        }

        return h.continue
      })
    }
  }
}
