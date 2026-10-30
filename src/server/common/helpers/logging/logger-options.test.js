import { loggerOptions } from './logger-options.js'

describe('loggerOptions', () => {
  test('removes redacted paths rather than masking them', () => {
    expect(loggerOptions.redact.remove).toBe(true)
  })

  test.each([
    'req.query.code',
    'req.query.state',
    'req.query.id_token',
    'req.query.access_token',
    'req.query.error_description'
  ])('always redacts %s from the sign-in callback', (path) => {
    expect(loggerOptions.redact.paths).toContain(path)
  })
})
