import { config } from '../../config/config.js'
import { loadAccountDetails } from '../common/helpers/load-account-details.js'
import { createLogger } from '../common/helpers/logging/logger.js'

const logger = createLogger('cookies-controller')

const cookieOptions = {
  ttl: 1000 * 60 * 60 * 24 * 365,
  path: '/',
  isSecure: config.get('session.cookie.secure'),
  isSameSite: 'Strict'
}

export const cookiesController = {
  async getHandler(request, h) {
    await loadAccountDetails(request)

    const policy = request.state.cookies_policy
    let cookiesPolicyUsage = null
    try {
      const parsedPolicy =
        typeof policy === 'string' ? JSON.parse(policy) : policy
      if (parsedPolicy && typeof parsedPolicy.usage === 'boolean') {
        cookiesPolicyUsage = parsedPolicy.usage ? 'yes' : 'no'
      }
    } catch (e) {
      logger.error('Failed to parse cookies_policy from request state', e)
    }

    return h.view('cookies/index', {
      pageTitle: 'Cookies',
      heading: 'Cookies',
      cookiesPolicyUsage,
      showSuccess: request.query.success === '1',
      breadcrumbs: [
        {
          text: 'Home',
          href: '/'
        },
        {
          text: 'Cookies'
        }
      ]
    })
  },

  async postHandler(request, h) {
    const { analytics } = request.payload || {}

    if (analytics === 'yes' || analytics === 'no') {
      const usage = analytics === 'yes'
      h.state(
        'cookies_policy',
        JSON.stringify({ essential: true, usage }),
        cookieOptions
      )
    }

    return h.redirect('/cookies?success=1')
  },

  async bannerPostHandler(request, h) {
    const analytics = request.payload?.analytics

    if (analytics === 'yes' || analytics === 'no') {
      const usage = analytics === 'yes'
      h.state(
        'cookies_policy',
        JSON.stringify({ essential: true, usage }),
        cookieOptions
      )
    }

    const referer = request.headers.referer || '/'
    try {
      const url = new URL(referer, request.url.origin)
      url.searchParams.set('cookie_preference', 'set')
      return h.redirect(url.pathname + url.search)
    } catch (e) {
      return h.redirect('/?cookie_preference=set')
    }
  },

  hideBannerPostHandler(request, h) {
    const referer = request.headers.referer || '/'
    try {
      const url = new URL(referer, request.url.origin)
      url.searchParams.delete('cookie_preference')
      return h.redirect(url.pathname + url.search)
    } catch (e) {
      return h.redirect('/')
    }
  }
}
