import { config } from '../../config.js'
import {
  buildAccountNavigation,
  buildNavigation,
  buildRegulatorContext
} from './build-navigation.js'

const USER_COOKIE_NAME = config.get('userCookie.name')

function mockRequest(options) {
  return { ...options }
}

describe('#buildAccountNavigation', () => {
  test('Should return organisationName if accountDetails is present', () => {
    expect(
      buildAccountNavigation(
        mockRequest({
          app: {
            accountDetails: {
              organisationName: 'Test Org'
            }
          }
        })
      )
    ).toEqual([{ text: 'Test Org' }])
  })

  test('Should return empty array if accountDetails is missing', () => {
    expect(buildAccountNavigation(mockRequest({}))).toEqual([])
  })
})

describe('#buildNavigation', () => {
  test('Should return empty array when session user is present', () => {
    const user = { token: 'mock-token', profile: { oid: 'user-id' } }
    expect(
      buildNavigation(
        mockRequest({
          path: '/',
          state: { [USER_COOKIE_NAME]: user }
        })
      )
    ).toEqual([])
  })

  test('Should return empty array when no session user', () => {
    expect(
      buildNavigation(
        mockRequest({
          yar: {
            id: null,
            get: () => undefined
          }
        })
      )
    ).toEqual([])
  })
})

describe('#buildRegulatorContext', () => {
  test('Should return Sign in link when no session user', () => {
    expect(
      buildRegulatorContext(
        mockRequest({
          yar: { id: null, get: () => undefined }
        }),
        'en'
      )
    ).toContain('Sign in')
  })

  test('Should return name and Sign out link when session user is present', () => {
    const user = { token: 'mock-token', profile: { oid: 'user-id' } }
    const html = buildRegulatorContext(
      mockRequest({
        path: '/',
        state: { [USER_COOKIE_NAME]: user },
        app: {
          accountDetails: {
            firstName: 'Test',
            lastName: 'User'
          }
        }
      }),
      'en'
    )
    expect(html).toContain('Test User')
    expect(html).toContain('Sign out')
  })

  test('Should fall back to session user name when accountDetails are absent', () => {
    const user = {
      token: 'mock-token',
      profile: { oid: 'user-id' },
      name: 'Jane Smith'
    }
    const html = buildRegulatorContext(
      mockRequest({
        path: '/',
        state: { [USER_COOKIE_NAME]: user }
      }),
      'en'
    )
    expect(html).toContain('Jane Smith')
    expect(html).toContain('Sign out')
  })

  test('Should append lang=cy to sign-in link for Welsh locale', () => {
    expect(
      buildRegulatorContext(
        mockRequest({
          yar: { id: null, get: () => undefined }
        }),
        'cy'
      )
    ).toContain('href="/signin-oidc?lang=cy"')
  })
})
