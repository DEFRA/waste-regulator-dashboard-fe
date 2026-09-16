import {
  applyForwardedPrefixToCookiePath,
  getForwardedPrefix,
  withForwardedPrefix
} from './forwarded-prefix.js'

function createRequest(prefix) {
  return {
    headers: prefix === undefined ? {} : { 'x-forwarded-prefix': prefix }
  }
}

describe('forwarded prefix helpers', () => {
  test('returns a valid proxy prefix without trailing slashes', () => {
    expect(
      getForwardedPrefix(createRequest('/manage-waste-dashboard///'))
    ).toBe('/manage-waste-dashboard')
  })

  test.each([
    undefined,
    '',
    '/',
    'manage-waste-dashboard',
    '//manage-waste-dashboard',
    '/manage-waste-dashboard/..',
    '/manage-waste-dashboard?q=1',
    '/manage-waste-dashboard, /another-path'
  ])('ignores an invalid forwarded prefix: %s', (prefix) => {
    expect(getForwardedPrefix(createRequest(prefix))).toBe('')
  })

  test('adds the prefix to application-local rooted paths', () => {
    const request = createRequest('/manage-waste-dashboard')

    expect(withForwardedPrefix(request, '/signin-oidc?lang=cy')).toBe(
      '/manage-waste-dashboard/signin-oidc?lang=cy'
    )
  })

  test('does not alter external or protocol-relative URLs', () => {
    const request = createRequest('/manage-waste-dashboard')

    expect(withForwardedPrefix(request, 'https://example.com/sign-in')).toBe(
      'https://example.com/sign-in'
    )
    expect(withForwardedPrefix(request, '//example.com/sign-in')).toBe(
      '//example.com/sign-in'
    )
  })

  test('scopes a cookie to the proxy prefix', () => {
    const definition = { path: '/' }

    applyForwardedPrefixToCookiePath(
      definition,
      createRequest('/manage-waste-dashboard')
    )

    expect(definition.path).toBe('/manage-waste-dashboard')
  })

  test('preserves the cookie path for direct and invalid proxy requests', () => {
    const directDefinition = { path: '/' }
    const invalidDefinition = { path: '/' }

    applyForwardedPrefixToCookiePath(directDefinition, createRequest())
    applyForwardedPrefixToCookiePath(
      invalidDefinition,
      createRequest('https://attacker.example')
    )

    expect(directDefinition.path).toBe('/')
    expect(invalidDefinition.path).toBe('/')
  })
})
