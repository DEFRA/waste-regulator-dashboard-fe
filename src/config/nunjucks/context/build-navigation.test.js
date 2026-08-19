import { buildNavigation } from './build-navigation.js'

function mockRequest(options) {
  return { ...options }
}

describe('#buildNavigation', () => {
  test('Should return sign in link when no session user', () => {
    expect(
      buildNavigation(mockRequest({ path: '/non-existent-path' }))
    ).toEqual([{ text: 'Sign in', href: '/signin-oidc' }])
  })

  test('Should return sign in link regardless of path when not authenticated', () => {
    expect(buildNavigation(mockRequest({ path: '/' }))).toEqual([
      { text: 'Sign in', href: '/signin-oidc' }
    ])
  })

  test('Should return sign in link when yar is not initialized', () => {
    expect(
      buildNavigation(
        mockRequest({
          yar: {
            id: null,
            get: () => {
              throw new Error('yar.get should not be called')
            }
          }
        })
      )
    ).toEqual([{ text: 'Sign in', href: '/signin-oidc' }])
  })

  test('Should return sign out link with user name when session user and account details are present', () => {
    const user = { token: 'mock-token', profile: { oid: 'user-id' } }

    expect(
      buildNavigation(
        mockRequest({
          path: '/',
          yar: {
            id: 'session-id',
            get: (key) => (key === 'user' ? user : undefined)
          },
          app: {
            accountDetails: {
              firstName: 'Test',
              lastName: 'User'
            }
          }
        })
      )
    ).toEqual([{ text: 'Test User' }, { text: 'Sign out', href: '/logout' }])
  })

  test('Should return only sign out link when session user is present but no account details', () => {
    const user = { token: 'mock-token', profile: { oid: 'user-id' } }

    expect(
      buildNavigation(
        mockRequest({
          path: '/',
          yar: {
            id: 'session-id',
            get: (key) => (key === 'user' ? user : undefined)
          }
        })
      )
    ).toEqual([{ text: 'Sign out', href: '/logout' }])
  })
})
