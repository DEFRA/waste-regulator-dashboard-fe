import { config } from '../../../../config/config.js'
import { defaultSessionCookieTtlMs } from '../../../../config/default-session-cookie-ttl.js'

import { sessionCache } from './session-cache.js'

describe('#sessionCache', () => {
  it('uses the env-derived session cookie default from config', () => {
    expect(config.get('session.cookie.ttl')).toBe(defaultSessionCookieTtlMs())
  })

  it('applies the configured session cookie ttl to the yar cookie', () => {
    expect(sessionCache.options.cookieOptions.ttl).toBe(
      config.get('session.cookie.ttl')
    )
  })
})
