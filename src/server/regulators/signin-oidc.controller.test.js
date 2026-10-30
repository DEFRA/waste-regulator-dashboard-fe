import { signinOidcController } from './controller.js'

function makeYar(initial = {}) {
  const store = { ...initial }
  return {
    id: 'session-id',
    get: vi.fn((key) => store[key] ?? null),
    set: vi.fn((key, val) => {
      store[key] = val
    }),
    clear: vi.fn((key) => {
      delete store[key]
    })
  }
}

function makeH() {
  return { redirect: vi.fn((url) => `redirect:${url}`) }
}

describe('signinOidcController when the sign-in callback fails', () => {
  // What Bell hands the handler in `try` mode: not authenticated, an error
  // naming the cause, and partial credentials that carry no profile.
  function failedRequest({
    message,
    data,
    query = {},
    headers = {},
    yar = makeYar(),
    logger = { warn: vi.fn() }
  } = {}) {
    const error = message ? new Error(message) : undefined
    if (error && data) {
      error.data = data
    }
    return {
      auth: {
        isAuthenticated: false,
        credentials: { provider: 'azure-ad-b2c', query: {} },
        error
      },
      query,
      headers,
      yar,
      logger
    }
  }

  const cancelledDescription =
    'AADB2C90091: The user has cancelled entering self-asserted information.\r\nCorrelation ID: 1234'

  test.each([
    [
      'B2C returns access_denied',
      {
        message: `App rejected: ${cancelledDescription}`,
        query: {
          error: 'access_denied',
          error_description: cancelledDescription
        }
      },
      'access_denied'
    ],
    [
      'the state does not match',
      {
        message: 'Incorrect azure-ad-b2c state parameter',
        query: { code: 'auth-code', state: 'stale-state' }
      },
      'state_mismatch'
    ],
    [
      'the state cookie is missing or expired',
      {
        message: 'Missing azure-ad-b2c request token cookie',
        query: { code: 'auth-code', state: 'some-state', refresh: '1' }
      },
      'missing_state_cookie'
    ],
    [
      'the code-for-token exchange fails',
      {
        message: 'Failed obtaining azure-ad-b2c access token',
        query: { code: 'auth-code', state: 'some-state' }
      },
      'token_exchange_failed'
    ]
  ])(
    'redirects to the sign-in-failed page and logs a warning when %s',
    (_case, options, reason) => {
      const logger = { warn: vi.fn() }
      const result = signinOidcController.handler(
        failedRequest({ ...options, logger }),
        makeH()
      )

      expect(result).toBe('redirect:/sign-in-failed')
      expect(logger.warn).toHaveBeenCalledWith(
        { signIn: expect.objectContaining({ reason }) },
        `Sign-in callback failed: ${reason}`
      )
    }
  )

  test.each([
    ['a failure it does not recognise', 'Something else went wrong'],
    ['no error from Bell at all', undefined]
  ])('logs reason unknown for %s', (_case, message) => {
    const logger = { warn: vi.fn() }
    signinOidcController.handler(failedRequest({ message, logger }), makeH())

    expect(logger.warn).toHaveBeenCalledWith(
      { signIn: { reason: 'unknown' } },
      'Sign-in callback failed: unknown'
    )
  })

  test("logs B2C's error and AADB2C code but not its free-text description", () => {
    const logger = { warn: vi.fn() }
    signinOidcController.handler(
      failedRequest({
        message: `App rejected: ${cancelledDescription}`,
        query: {
          error: 'access_denied',
          error_description: cancelledDescription
        },
        logger
      }),
      makeH()
    )

    expect(logger.warn).toHaveBeenCalledWith(
      {
        signIn: {
          reason: 'access_denied',
          b2cError: 'access_denied',
          b2cErrorCode: 'AADB2C90091'
        }
      },
      'Sign-in callback failed: access_denied'
    )
  })

  test('leaves out a B2C error value that is not an OAuth error code', () => {
    const logger = { warn: vi.fn() }
    signinOidcController.handler(
      failedRequest({
        message: 'Something else went wrong',
        query: { error: '<script>alert(1)</script>' },
        logger
      }),
      makeH()
    )

    expect(logger.warn.mock.calls[0][0].signIn).not.toHaveProperty('b2cError')
  })

  test('keeps the auth code, state and token payload out of the log', () => {
    const logger = { warn: vi.fn() }
    signinOidcController.handler(
      failedRequest({
        message: 'Failed obtaining azure-ad-b2c access token',
        data: {
          access_token: 'secret-access-token',
          id_token: 'secret-id-token'
        },
        query: { code: 'secret-auth-code', state: 'secret-state' },
        logger
      }),
      makeH()
    )

    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain('secret-')
  })

  test('does not store the partial credentials Bell passes as the user', () => {
    const yar = makeYar()
    signinOidcController.handler(
      failedRequest({
        message: 'Incorrect azure-ad-b2c state parameter',
        yar
      }),
      makeH()
    )

    expect(yar.set).not.toHaveBeenCalledWith('user', expect.anything())
  })

  // returnTo is a protected page, which would send them straight back to
  // /signin-oidc: a loop.
  test('does not send the person back into the service or into sign-in by itself', () => {
    const h = makeH()
    signinOidcController.handler(
      failedRequest({
        message: 'Missing azure-ad-b2c request token cookie',
        yar: makeYar({ returnTo: '/dashboard/home' })
      }),
      h
    )

    expect(h.redirect).toHaveBeenCalledTimes(1)
    expect(h.redirect).toHaveBeenCalledWith('/sign-in-failed')
  })

  test('keeps returnTo and authLocale so a retry lands where the person was going', () => {
    const yar = makeYar({ returnTo: '/dashboard/home', authLocale: 'cy' })
    const result = signinOidcController.handler(
      failedRequest({
        message: 'Incorrect azure-ad-b2c state parameter',
        yar
      }),
      makeH()
    )

    expect(result).toBe('redirect:/sign-in-failed?lang=cy')
    expect(yar.clear).not.toHaveBeenCalledWith('returnTo')
    expect(yar.clear).not.toHaveBeenCalledWith('authLocale')
  })

  test('redirects to the sign-in-failed page behind the proxy prefix', () => {
    const result = signinOidcController.handler(
      failedRequest({
        message: 'Incorrect azure-ad-b2c state parameter',
        headers: { 'x-forwarded-prefix': '/dashboard' }
      }),
      makeH()
    )

    expect(result).toBe('redirect:/dashboard/sign-in-failed')
  })

  test('sends someone already signed in on to returnTo when a callback is replayed', () => {
    const h = makeH()
    signinOidcController.handler(
      failedRequest({
        message: 'Missing azure-ad-b2c request token cookie',
        yar: makeYar({
          user: { profile: { oid: 'user-oid' } },
          returnTo: '/dashboard/home'
        })
      }),
      h
    )

    expect(h.redirect).toHaveBeenCalledWith('/dashboard/home')
  })
})

describe('signinOidcController when B2C signs someone in', () => {
  const signedIn = (credentials, yar = makeYar()) => ({
    auth: { isAuthenticated: true, credentials },
    query: {},
    headers: {},
    yar
  })

  test.each([
    ['an oid', { oid: '0b6f8f9e-2c4d-4e5a-9b1c-7d3e2f1a0b9c' }],
    ['only a sub', { sub: '0b6f8f9e-2c4d-4e5a-9b1c-7d3e2f1a0b9c' }]
  ])(
    'stores the user and redirects to /home for a profile with %s',
    (_case, profile) => {
      const yar = makeYar()
      const credentials = { token: 'access-token', profile }
      const result = signinOidcController.handler(
        signedIn(credentials, yar),
        makeH()
      )

      expect(yar.set).toHaveBeenCalledWith('user', credentials)
      expect(result).toBe('redirect:/home')
    }
  )

  test.each([
    ['no profile, because there was no id_token', undefined],
    ['no oid or sub', { email: 'person@example.com' }],
    ['an oid that is not a GUID', { oid: 'not-a-guid' }]
  ])('responds with a 500 and stores no user for %s', (_case, profile) => {
    const yar = makeYar()
    const h = makeH()
    const result = signinOidcController.handler(
      signedIn({ token: 'access-token', profile }, yar),
      h
    )

    expect(result.isBoom).toBe(true)
    expect(result.output.statusCode).toBe(500)
    expect(result.message).toBe(
      'B2C sign-in returned no usable user id (oid or sub)'
    )
    expect(yar.set).not.toHaveBeenCalled()
    expect(h.redirect).not.toHaveBeenCalled()
  })

  test('clears a user left in the session by an earlier sign-in, but keeps returnTo and authLocale', () => {
    const yar = makeYar({
      user: { profile: { oid: '0b6f8f9e-2c4d-4e5a-9b1c-7d3e2f1a0b9c' } },
      returnTo: '/dashboard/home',
      authLocale: 'cy'
    })
    const result = signinOidcController.handler(
      signedIn({ token: 'access-token', profile: undefined }, yar),
      makeH()
    )

    expect(result.output.statusCode).toBe(500)
    expect(yar.get('user')).toBeNull()
    expect(yar.get('returnTo')).toBe('/dashboard/home')
    expect(yar.get('authLocale')).toBe('cy')
  })
})
