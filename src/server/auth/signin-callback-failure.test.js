import {
  b2cErrorDetails,
  classifySigninFailure,
  signinFailureReasons
} from './signin-callback-failure.js'

const failedWith = (message) => ({ auth: { error: new Error(message) } })

describe('#classifySigninFailure', () => {
  test.each([
    [
      'App rejected: AADB2C90091: The user has cancelled.',
      signinFailureReasons.accessDenied
    ],
    [
      'Incorrect azure-ad-b2c state parameter',
      signinFailureReasons.stateMismatch
    ],
    [
      'Missing azure-ad-b2c request token cookie',
      signinFailureReasons.missingStateCookie
    ],
    [
      'Failed obtaining azure-ad-b2c access token',
      signinFailureReasons.tokenExchangeFailed
    ],
    ['Something else went wrong', signinFailureReasons.unknown]
  ])('classifies "%s" as %s', (message, reason) => {
    expect(classifySigninFailure(failedWith(message))).toBe(reason)
  })

  test.each([
    ['no auth on the request', {}],
    ['no error from Bell', { auth: {} }],
    ['an error with no message', { auth: { error: {} } }]
  ])('returns unknown for %s', (_case, request) => {
    expect(classifySigninFailure(request)).toBe(signinFailureReasons.unknown)
  })
})

describe('#b2cErrorDetails', () => {
  test('returns the OAuth error and the AADB2C code', () => {
    expect(
      b2cErrorDetails({
        query: {
          error: 'access_denied',
          error_description:
            'AADB2C90091: The user has cancelled.\r\nCorrelation ID: 1234'
        }
      })
    ).toEqual({ b2cError: 'access_denied', b2cErrorCode: 'AADB2C90091' })
  })

  test('returns a 6-digit AADB2C code', () => {
    expect(
      b2cErrorDetails({
        query: { error_description: 'AADB2C990001: Session expired.' }
      })
    ).toEqual({ b2cErrorCode: 'AADB2C990001' })
  })

  test('leaves out the code when the description has none', () => {
    expect(
      b2cErrorDetails({
        query: {
          error: 'server_error',
          error_description: 'Something went wrong.'
        }
      })
    ).toEqual({ b2cError: 'server_error' })
  })

  test.each([
    ['upper case', 'ACCESS_DENIED'],
    ['markup', '<script>alert(1)</script>'],
    ['longer than 64 characters', 'a'.repeat(65)],
    ['not a string', ['access_denied']]
  ])('leaves out an error value that is %s', (_case, error) => {
    expect(b2cErrorDetails({ query: { error } })).toEqual({})
  })

  test('leaves out a description that is not a string', () => {
    expect(
      b2cErrorDetails({ query: { error_description: ['AADB2C90091'] } })
    ).toEqual({})
  })

  test.each([
    ['no query on the request', {}],
    ['an empty query', { query: {} }]
  ])('returns nothing for %s', (_case, request) => {
    expect(b2cErrorDetails(request)).toEqual({})
  })
})
