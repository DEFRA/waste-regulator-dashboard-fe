import { vi } from 'vitest'

const mockReadFileSync = vi.fn()
const mockLoggerError = vi.fn()

vi.mock('node:fs', async () => {
  const nodeFs = await import('node:fs')

  return {
    ...nodeFs,
    readFileSync: (path, encoding) => {
      if (String(path).includes('assets-manifest.json')) {
        const result = mockReadFileSync()
        if (result instanceof Error) {
          throw result
        }
        return result
      }

      return nodeFs.readFileSync(path, encoding)
    }
  }
})
vi.mock('../../../server/common/helpers/logging/logger.js', () => ({
  createLogger: () => ({ error: (...args) => mockLoggerError(...args) })
}))

describe('context and cache', () => {
  beforeEach(() => {
    mockReadFileSync.mockReset()
    mockLoggerError.mockReset()
    vi.resetModules()
  })

  describe('#context', () => {
    const mockRequest = {
      path: '/',
      url: { search: '' },
      yar: { get: () => undefined },
      state: { cookies_policy: { essential: true, usage: true } }
    }

    describe('When webpack manifest file read succeeds', () => {
      let contextImport
      let contextResult

      beforeAll(async () => {
        contextImport = await import('./context.js')
      })

      beforeEach(() => {
        // Return JSON string
        mockReadFileSync.mockReturnValue(`{
        "application.js": "javascripts/application.js",
        "stylesheets/application.scss": "stylesheets/application.css"
      }`)

        contextResult = contextImport.context(mockRequest)
      })

      test('Should provide expected context', () => {
        expect(contextResult).toEqual({
          assetPath: '/public/assets',
          breadcrumbs: [],
          getAssetPath: expect.any(Function),
          allowGoogleAnalytics: true,
          ga4: 'G-4M1Z0WGY6J',
          gtm: 'GTM-52C6V74Q',
          locale: 'en',
          localeUrl: expect.any(Function),
          languageSwitcher: {
            en: '/?lang=en',
            cy: '/?lang=cy'
          },
          navigation: [],
          accountNavigation: [],
          regulatorContext: expect.any(String),
          serviceName: "pEPR: Regulators' Service",
          serviceUrl: '/',
          cspNonce: undefined,
          hasCookiePolicy: true,
          cookiePreferenceSet: false,
          helpDeskEmail: 'eprcustomerservice@defra.gov.uk',
          features: {
            certificateOfCompliance: false
          }
        })
      })

      describe('With valid asset path', () => {
        test('Should provide expected asset path', () => {
          expect(contextResult.getAssetPath('application.js')).toBe(
            '/public/javascripts/application.js'
          )
        })
      })

      describe('With invalid asset path', () => {
        test('Should provide expected asset', () => {
          expect(contextResult.getAssetPath('an-image.png')).toBe(
            '/public/an-image.png'
          )
        })
      })
    })

    describe('When webpack manifest file read fails', () => {
      let contextImport

      beforeAll(async () => {
        contextImport = await import('./context.js')
      })

      beforeEach(() => {
        mockReadFileSync.mockReturnValue(new Error('File not found'))

        contextImport.context(mockRequest)
      })

      test('Should log that the Webpack Manifest file is not available', () => {
        expect(mockLoggerError).toHaveBeenCalledWith(
          'Webpack assets-manifest.json not found'
        )
      })
    })

    describe('When cookies_policy.usage is false', () => {
      let contextImport
      let contextResult

      beforeAll(async () => {
        contextImport = await import('./context.js')
      })

      beforeEach(() => {
        const req = {
          path: '/',
          url: { search: '' },
          yar: { get: () => undefined },
          state: { cookies_policy: { essential: true, usage: false } }
        }
        mockReadFileSync.mockReturnValue(`{}`)
        contextResult = contextImport.context(req)
      })

      test('Should provide allowGoogleAnalytics as false', () => {
        expect(contextResult.allowGoogleAnalytics).toBe(false)
      })
    })

    describe('When GA4 and GTM are set in the config', () => {
      let contextImport
      let contextResult

      beforeAll(async () => {
        const { config } = await import('../../config.js')
        config.set('GA4', 'TEST-ID')
        config.set('GTM', 'TEST-TAG')
        contextImport = await import('./context.js')
      })

      afterAll(async () => {
        const { config } = await import('../../config.js')
        config.set('GA4', '')
        config.set('GTM', '')
      })

      beforeEach(() => {
        const req = {
          path: '/',
          url: { search: '' },
          yar: { get: () => undefined },
          state: { cookies_policy: { essential: true, usage: true } }
        }
        mockReadFileSync.mockReturnValue(`{}`)
        contextResult = contextImport.context(req)
      })

      test('Should provide expected tags object', () => {
        expect(contextResult.ga4).toBe('TEST-ID')
        expect(contextResult.gtm).toBe('TEST-TAG')
      })
    })
  })

  describe('#context cache', () => {
    const mockRequest = {
      path: '/',
      url: { search: '' },
      yar: { get: () => undefined },
      state: { cookies_policy: { essential: true, usage: true } }
    }
    let contextResult

    describe('Webpack manifest file cache', () => {
      let contextImport

      beforeAll(async () => {
        contextImport = await import('./context.js')
      })

      beforeEach(() => {
        // Return JSON string
        mockReadFileSync.mockReturnValue(`{
        "application.js": "javascripts/application.js",
        "stylesheets/application.scss": "stylesheets/application.css"
      }`)

        contextResult = contextImport.context(mockRequest)
      })

      test('Should read file', () => {
        expect(mockReadFileSync).toHaveBeenCalled()
      })

      test('Should use cache', () => {
        expect(mockReadFileSync).not.toHaveBeenCalled()
      })

      test('Should provide expected context', () => {
        expect(contextResult).toEqual({
          assetPath: '/public/assets',
          breadcrumbs: [],
          getAssetPath: expect.any(Function),
          allowGoogleAnalytics: true,
          ga4: '',
          gtm: '',
          locale: 'en',
          localeUrl: expect.any(Function),
          languageSwitcher: {
            en: '/?lang=en',
            cy: '/?lang=cy'
          },
          navigation: [],
          accountNavigation: [],
          regulatorContext: expect.any(String),
          serviceName: "pEPR: Regulators' Service",
          serviceUrl: '/',
          cspNonce: undefined,
          hasCookiePolicy: true,
          cookiePreferenceSet: false,
          helpDeskEmail: 'eprcustomerservice@defra.gov.uk',
          features: {
            certificateOfCompliance: false
          }
        })
      })
    })
  })
})
