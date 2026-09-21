import { describe, it, expect } from 'vitest'
import {
  bellRedirectLocation,
  resolvePostLogoutAbsoluteUri
} from './azure-ad-b2c.js'

describe('resolvePostLogoutAbsoluteUri', () => {
  function makeRequest({
    protocol = 'http',
    host = 'localhost:7154',
    xForwardedProto,
    xForwardedHost,
    xForwardedPrefix
  } = {}) {
    return {
      headers: {
        ...(xForwardedProto ? { 'x-forwarded-proto': xForwardedProto } : {}),
        ...(xForwardedHost ? { 'x-forwarded-host': xForwardedHost } : {}),
        ...(xForwardedPrefix ? { 'x-forwarded-prefix': xForwardedPrefix } : {}),
        host
      },
      server: { info: { protocol } },
      info: { host }
    }
  }

  it('includes the forwarded prefix in the fallback URI when behind a proxy', () => {
    const request = makeRequest({
      xForwardedProto: 'https',
      xForwardedHost: 'proxy.example.com',
      xForwardedPrefix: '/manage-waste-dashboard'
    })

    expect(resolvePostLogoutAbsoluteUri(request, '/signed-out', {})).toBe(
      'https://proxy.example.com/manage-waste-dashboard/signed-out'
    )
  })

  it('does not double-prefix when the fallback URI already had no prefix', () => {
    const request = makeRequest({
      xForwardedProto: 'https',
      xForwardedHost: 'proxy.example.com'
    })

    expect(resolvePostLogoutAbsoluteUri(request, '/signed-out', {})).toBe(
      'https://proxy.example.com/signed-out'
    )
  })

  it('includes the forwarded prefix when redirectUri is an absolute URL', () => {
    const request = makeRequest({
      xForwardedProto: 'https',
      xForwardedPrefix: '/manage-waste-dashboard',
      host: 'proxy.example.com'
    })

    expect(
      resolvePostLogoutAbsoluteUri(request, '/signed-out', {
        redirectUri:
          'https://proxy.example.com/manage-waste-dashboard/login/b2c/callback'
      })
    ).toBe('https://proxy.example.com/manage-waste-dashboard/signed-out')
  })

  it('falls back to request host without prefix when not behind a proxy', () => {
    const request = makeRequest({ protocol: 'http', host: 'localhost:7154' })

    expect(resolvePostLogoutAbsoluteUri(request, '/signed-out', {})).toBe(
      'http://localhost:7154/signed-out'
    )
  })

  it('returns the pathOrUrl unchanged when it is already an absolute URL', () => {
    const request = makeRequest({
      xForwardedProto: 'https',
      xForwardedHost: 'proxy.example.com',
      xForwardedPrefix: '/manage-waste-dashboard'
    })

    expect(
      resolvePostLogoutAbsoluteUri(
        request,
        'https://proxy.example.com/manage-waste-dashboard/signed-out',
        {}
      )
    ).toBe('https://proxy.example.com/manage-waste-dashboard/signed-out')
  })
})

describe('bellRedirectLocation', () => {
  function makeRequest({
    protocol = 'http',
    host = 'localhost:7154',
    xForwardedProto,
    xForwardedHost,
    xForwardedPrefix,
    path = '/signin-oidc'
  } = {}) {
    return {
      path,
      headers: {
        ...(xForwardedProto ? { 'x-forwarded-proto': xForwardedProto } : {}),
        ...(xForwardedHost ? { 'x-forwarded-host': xForwardedHost } : {}),
        ...(xForwardedPrefix ? { 'x-forwarded-prefix': xForwardedPrefix } : {}),
        host
      },
      server: { info: { protocol } },
      info: { host }
    }
  }

  it('uses x-forwarded-host, prefix and proto when behind the proxy', () => {
    const request = makeRequest({
      xForwardedProto: 'https',
      xForwardedHost: 'proxy.example.com',
      xForwardedPrefix: '/dashboard'
    })

    expect(bellRedirectLocation(request)).toBe(
      'https://proxy.example.com/dashboard/signin-oidc'
    )
  })

  it('uses x-forwarded-host and proto without prefix when no prefix header is set', () => {
    const request = makeRequest({
      xForwardedProto: 'https',
      xForwardedHost: 'proxy.example.com'
    })

    expect(bellRedirectLocation(request)).toBe(
      'https://proxy.example.com/signin-oidc'
    )
  })

  it('falls back to request host and server protocol when not behind a proxy', () => {
    const request = makeRequest({ protocol: 'http', host: 'localhost:7154' })

    expect(bellRedirectLocation(request)).toBe(
      'http://localhost:7154/signin-oidc'
    )
  })

  it('upgrades to https via x-forwarded-proto even without x-forwarded-host', () => {
    const request = makeRequest({
      xForwardedProto: 'https',
      host: 'localhost:7154'
    })

    expect(bellRedirectLocation(request)).toBe(
      'https://localhost:7154/signin-oidc'
    )
  })

  it('uses first value from comma-separated x-forwarded-host', () => {
    const request = makeRequest({
      xForwardedProto: 'https',
      xForwardedHost: 'first.example.com, second.example.com'
    })

    expect(bellRedirectLocation(request)).toBe(
      'https://first.example.com/signin-oidc'
    )
  })
})
