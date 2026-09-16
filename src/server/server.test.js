import { bellRedirectOrigin } from './server.js'

describe('bellRedirectOrigin', () => {
  test('returns undefined when redirectUri is undefined', () => {
    expect(bellRedirectOrigin(undefined, false)).toBeUndefined()
  })

  test('returns the origin only when the redirect URI is at the root path', () => {
    expect(
      bellRedirectOrigin('https://proxy.example/signin-oidc', false)
    ).toBe('https://proxy.example')
  })

  test('preserves the path prefix for a redirect URI with a subpath', () => {
    expect(
      bellRedirectOrigin('https://proxy.example/dashboard/signin-oidc', false)
    ).toBe('https://proxy.example/dashboard')
  })

  test('upgrades http to https when tls is enabled', () => {
    expect(
      bellRedirectOrigin('http://proxy.example/signin-oidc', true)
    ).toBe('https://proxy.example')
  })

  test('does not upgrade scheme when tls is not enabled', () => {
    expect(
      bellRedirectOrigin('http://proxy.example/signin-oidc', false)
    ).toBe('http://proxy.example')
  })

  test('does not alter an already-https URI when tls is enabled', () => {
    expect(
      bellRedirectOrigin('https://proxy.example/signin-oidc', true)
    ).toBe('https://proxy.example')
  })
})
