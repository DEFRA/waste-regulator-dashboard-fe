import { createServer } from '../server.js'
import { statusCodes } from '../common/constants/status-codes.js'

describe('#cookiesController', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  describe('GET /cookies', () => {
    test('Should provide expected response', async () => {
      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: '/cookies'
      })

      expect(result).toEqual(expect.stringContaining('Cookies |'))
      expect(result).toEqual(expect.stringContaining('Save cookie settings'))
      expect(statusCode).toBe(statusCodes.ok)
    })

    test('Should show success banner when success=1', async () => {
      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: '/cookies?success=1'
      })

      expect(result).toEqual(expect.stringContaining('Success'))
      expect(result).toEqual(
        expect.stringContaining('You’ve set your cookie preferences.')
      )
      expect(statusCode).toBe(statusCodes.ok)
    })
  })

  describe('POST /cookies', () => {
    test('Should redirect and set cookie when analytics is yes', async () => {
      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: '/cookies',
        payload: {
          analytics: 'yes'
        }
      })

      expect(statusCode).toBe(statusCodes.found)
      expect(headers.location).toBe('/cookies?success=1')
      const cookies = headers['set-cookie']
      expect(cookies[0]).toMatch(/cookies_policy=/)
      expect(cookies[0]).toContain('{"essential":true,"usage":true}')
    })

    test('Should redirect and set cookie when analytics is no', async () => {
      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: '/cookies',
        payload: {
          analytics: 'no'
        }
      })

      expect(statusCode).toBe(statusCodes.found)
      expect(headers.location).toBe('/cookies?success=1')
      const cookies = headers['set-cookie']
      expect(cookies[0]).toMatch(/cookies_policy=/)
      expect(cookies[0]).toContain('{"essential":true,"usage":false}')
    })

    test('Should redirect but not change cookie on invalid input', async () => {
      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: '/cookies',
        payload: {
          analytics: 'maybe'
        }
      })

      expect(statusCode).toBe(statusCodes.found)
      expect(headers.location).toBe('/cookies?success=1')

      const cookies = headers['set-cookie']
      if (cookies) {
        const hasCookiesPolicy = cookies.some((c) =>
          c.includes('cookies_policy=')
        )
        expect(hasCookiesPolicy).toBe(false)
      } else {
        expect(cookies).toBeUndefined()
      }
    })
  })

  describe('POST /cookies/banner', () => {
    test('Should redirect to referrer with cookie_preference=set and set cookie when analytics is yes', async () => {
      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: '/cookies/banner',
        headers: {
          referer: '/some-page'
        },
        payload: {
          analytics: 'yes'
        }
      })

      expect(statusCode).toBe(statusCodes.found)
      expect(headers.location).toBe('/some-page?cookie_preference=set')
      const cookies = headers['set-cookie']
      expect(cookies[0]).toMatch(/cookies_policy=/)
      expect(cookies[0]).toContain('{"essential":true,"usage":true}')
    })

    test('Should redirect to referrer with cookie_preference=set and set cookie when analytics is no', async () => {
      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: '/cookies/banner',
        headers: {
          referer: '/another-page'
        },
        payload: {
          analytics: 'no'
        }
      })

      expect(statusCode).toBe(statusCodes.found)
      expect(headers.location).toBe('/another-page?cookie_preference=set')
      const cookies = headers['set-cookie']
      expect(cookies[0]).toMatch(/cookies_policy=/)
      expect(cookies[0]).toContain('{"essential":true,"usage":false}')
    })

    test('Should redirect to fallback if referer is missing', async () => {
      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: '/cookies/banner',
        payload: {
          analytics: 'yes'
        }
      })

      expect(statusCode).toBe(statusCodes.found)
      expect(headers.location).toBe('/?cookie_preference=set')
    })
  })

  describe('POST /cookies/hide-banner', () => {
    test('Should strip cookie_preference query parameter from referrer and redirect', async () => {
      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: '/cookies/hide-banner',
        headers: {
          referer: '/some-page?cookie_preference=set'
        }
      })

      expect(statusCode).toBe(statusCodes.found)
      expect(headers.location).toBe('/some-page')
    })

    test('Should maintain other query parameters from referrer and redirect', async () => {
      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: '/cookies/hide-banner',
        headers: {
          referer: '/some-page?cookie_preference=set&other_param=1'
        }
      })

      expect(statusCode).toBe(statusCodes.found)
      expect(headers.location).toBe('/some-page?other_param=1')
    })

    test('Should redirect to fallback if referer is missing', async () => {
      const { statusCode, headers } = await server.inject({
        method: 'POST',
        url: '/cookies/hide-banner'
      })

      expect(statusCode).toBe(statusCodes.found)
      expect(headers.location).toBe('/')
    })
  })
})
