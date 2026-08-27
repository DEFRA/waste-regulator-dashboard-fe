import { createServer } from '../server.js'
import { statusCodes } from '../common/constants/status-codes.js'
import { errorPageFor } from '../common/helpers/errors.js'

const HELP_DESK_EMAIL = 'eprcustomerservice@defra.gov.uk'

// These are journey tests: they check a request reaches the right page, not
// what that page says. The exact copy is pinned in errors.test.js, so the
// heading is read from the mapping rather than restated here.
const titleFor = (statusCode) => errorPageFor(statusCode).pageTitle

const headingOf = (payload) =>
  payload.match(/<h1[^>]*>([^<]*)<\/h1>/)?.[1]?.trim()

// The <head> title comes first in the document; the crown logo has one too.
const titleOf = (payload) =>
  payload.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1]?.trim()

describe('error pages — journey', () => {
  let server

  beforeAll(async () => {
    server = await createServer()
    await server.initialize()
  })

  afterAll(async () => {
    await server.stop({ timeout: 0 })
  })

  const inject = (url) => server.inject({ method: 'GET', url })

  describe('preview routes', () => {
    it('lists every example on the index page', async () => {
      const response = await inject('/error-examples')

      expect(response.statusCode).toBe(statusCodes.ok)
      for (const statusCode of [403, 404, 500, 503]) {
        expect(response.payload).toContain(`/error-examples/${statusCode}`)
      }
    })

    it('shows the access denied page with its status code', async () => {
      const response = await inject('/error-examples/403')

      expect(response.statusCode).toBe(statusCodes.forbidden)
      expect(response.payload).toContain(titleFor(statusCodes.forbidden))
      expect(response.payload).toContain(`mailto:${HELP_DESK_EMAIL}`)
    })

    it('shows the page not found page with its status code', async () => {
      const response = await inject('/error-examples/404')

      expect(response.statusCode).toBe(statusCodes.notFound)
      expect(response.payload).toContain(titleFor(statusCodes.notFound))
      expect(response.payload).toContain(
        'If you pasted the web address, check you copied the entire address.'
      )
    })

    it('shows the problem with the service page with its status code', async () => {
      const response = await inject('/error-examples/500')

      expect(response.statusCode).toBe(statusCodes.internalServerError)
      expect(response.payload).toContain(
        titleFor(statusCodes.internalServerError)
      )
      expect(response.payload).toContain('Try again later.')
    })

    it('shows the service unavailable page with its status code', async () => {
      const response = await inject('/error-examples/503')

      expect(response.statusCode).toBe(statusCodes.serviceUnavailable)
      expect(response.payload).toContain(
        titleFor(statusCodes.serviceUnavailable)
      )
    })

    // The templates render the heading from pageTitle, so a page cannot end up
    // with a <title> and an <h1> that disagree.
    it.each([
      statusCodes.forbidden,
      statusCodes.notFound,
      statusCodes.internalServerError,
      statusCodes.serviceUnavailable
    ])('uses the same text for the heading and title of %i', async (code) => {
      const response = await inject(`/error-examples/${code}`)

      expect(headingOf(response.payload)).toBe(titleFor(code))
    })

    it('shows the not found page for an unknown example', async () => {
      const response = await inject('/error-examples/418')

      expect(response.statusCode).toBe(statusCodes.notFound)
      expect(response.payload).toContain(titleFor(statusCodes.notFound))
    })
  })

  describe('an unknown address', () => {
    it('shows the page not found page', async () => {
      const response = await inject('/no-such-page')

      expect(response.statusCode).toBe(statusCodes.notFound)
      expect(response.payload).toContain(titleFor(statusCodes.notFound))
      expect(response.payload).toContain(
        'If you typed the web address, check it is correct.'
      )
      expect(titleOf(response.payload)).toBe(
        'Page not found | pEPR: Regulators&#39; Service'
      )
    })
  })
})
