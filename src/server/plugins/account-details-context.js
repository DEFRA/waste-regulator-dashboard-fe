import { getSessionUser } from '../common/helpers/get-session-user.js'
import { loadAccountDetails } from '../common/helpers/load-account-details.js'

export const accountDetailsContext = {
  plugin: {
    name: 'account-details-context',
    register(server) {
      server.ext({
        type: 'onPreHandler',
        method: async (request, h) => {
          if (getSessionUser(request)) {
            await loadAccountDetails(request)
          }
          return h.continue
        }
      })
    }
  }
}
