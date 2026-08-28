import { describe, test, expect, beforeAll, beforeEach, vi } from 'vitest'

const mockLoggerError = vi.fn()

vi.mock('../../../server/common/helpers/logging/logger.js', () => ({
  createLogger: () => ({ error: (...args) => mockLoggerError(...args) })
}))

describe('buildGoogleTags', () => {
  let module
  let testConfig

  beforeAll(async () => {
    module = await import('./build-google-tags.js')
    testConfig = (await import('../../config.js')).config
  })

  beforeEach(() => {
    mockLoggerError.mockReset()
    vi.resetModules()
    testConfig.set('GA4', 'G-TESTID123')
    testConfig.set('GTM', 'GTM-TESTTAG123')
  })

  test('Should return tags from config and false for allowGoogleAnalytics by default', () => {
    const tags = module.buildGoogleTags({})
    expect(tags).toEqual({
      allowGoogleAnalytics: false,
      ga4: 'G-TESTID123',
      gtm: 'GTM-TESTTAG123'
    })
  })

  test('Should return allowGoogleAnalytics true if cookie usage is true', () => {
    const tags = module.buildGoogleTags({
      state: {
        cookies_policy: JSON.stringify({ essential: true, usage: true })
      }
    })
    expect(tags).toEqual({
      allowGoogleAnalytics: true,
      ga4: 'G-TESTID123',
      gtm: 'GTM-TESTTAG123'
    })
  })

  test('Should return allowGoogleAnalytics as false if cookie usage is false', () => {
    const tags = module.buildGoogleTags({
      state: {
        cookies_policy: JSON.stringify({ essential: true, usage: false })
      }
    })
    expect(tags).toEqual({
      allowGoogleAnalytics: false,
      ga4: 'G-TESTID123',
      gtm: 'GTM-TESTTAG123'
    })
  })

  test('Should log an error if cookies_policy is invalid JSON', () => {
    const tags = module.buildGoogleTags({
      state: { cookies_policy: 'invalid json' }
    })
    expect(mockLoggerError).toHaveBeenCalledWith(
      'Failed to parse cookies_policy from request state',
      expect.any(SyntaxError)
    )
    expect(tags).toEqual({
      allowGoogleAnalytics: false,
      ga4: 'G-TESTID123',
      gtm: 'GTM-TESTTAG123'
    })
  })
})
