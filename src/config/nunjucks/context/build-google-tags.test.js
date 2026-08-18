import { describe, test, expect, beforeAll, beforeEach, vi } from 'vitest'

const mockLoggerError = vi.fn()

vi.mock('../../../server/common/helpers/logging/logger.js', () => ({
  createLogger: () => ({ error: (...args) => mockLoggerError(...args) })
}))

describe('buildGoogleTags', () => {
  beforeEach(() => {
    mockLoggerError.mockReset()
    vi.resetModules()
  })

  describe('When isProduction is true', () => {
    let testConfig
    let module

    beforeAll(async () => {
      module = await import('./build-google-tags.js')
      testConfig = (await import('../../config.js')).config
    })

    beforeEach(async () => {
      testConfig.set('isProduction', true)
    })

    test('Should return null for id and tag and true for allowGoogleAnalytics by default', () => {
      const tags = module.buildGoogleTags({})
      expect(tags).toEqual({
        allowGoogleAnalytics: true,
        ga: {
          id: null,
          tag: null
        }
      })
    })

    test('Should return allowGoogleAnalytics true if cookie usage is true', () => {
      const tags = module.buildGoogleTags({
        state: { cookies_policy: JSON.stringify({ usage: true }) }
      })
      expect(tags).toEqual({
        allowGoogleAnalytics: true,
        ga: {
          id: null,
          tag: null
        }
      })
    })
  })

  describe('When isProduction is false', () => {
    let testConfig
    let module

    beforeAll(async () => {
      module = await import('./build-google-tags.js')
      testConfig = (await import('../../config.js')).config
    })

    beforeEach(async () => {
      testConfig.set('isProduction', false)
    })

    test('Should return non-production tags and true for allowGoogleAnalytics by default', () => {
      const tags = module.buildGoogleTags({})
      expect(tags).toEqual({
        allowGoogleAnalytics: true,
        ga: {
          id: 'G-9YS32BSK6B',
          tag: 'GTM-NBWSJJF2'
        }
      })
    })

    test('Should return allowGoogleAnalytics true if cookie usage is true', () => {
      const tags = module.buildGoogleTags({
        state: { cookies_policy: { usage: true } }
      })
      expect(tags).toEqual({
        allowGoogleAnalytics: true,
        ga: {
          id: 'G-9YS32BSK6B',
          tag: 'GTM-NBWSJJF2'
        }
      })
    })
  })

  describe('When allowGoogleAnalytics is false (cookie usage false)', () => {
    let testConfig
    let module

    beforeAll(async () => {
      module = await import('./build-google-tags.js')
      testConfig = (await import('../../config.js')).config
    })

    beforeEach(async () => {
      testConfig.set('isProduction', false)
    })

    test('Should return allowGoogleAnalytics as false', () => {
      const tags = module.buildGoogleTags({
        state: { cookies_policy: JSON.stringify({ usage: false }) }
      })
      expect(tags).toEqual({
        allowGoogleAnalytics: false,
        ga: {
          id: 'G-9YS32BSK6B',
          tag: 'GTM-NBWSJJF2'
        }
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
        allowGoogleAnalytics: true,
        ga: {
          id: 'G-9YS32BSK6B',
          tag: 'GTM-NBWSJJF2'
        }
      })
    })
  })
})
