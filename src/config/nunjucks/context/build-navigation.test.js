import {
  buildAccountNavigation,
  buildNavigation,
  buildRegulatorContext
} from './build-navigation.js'

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
  test('Should return Manage account link when session user is present', () => {
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
    ).toEqual([
      {
        href: 'https://rwd-dev9.azure.defra.cloud/regulators/manage-account/manage',
        text: 'Manage account'
      }
    ])
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
        })
      )
    ).toContain('Sign in')
  })

  test('Should return name and Sign out link when session user is present', () => {
    const user = { token: 'mock-token', profile: { oid: 'user-id' } }
    const html = buildRegulatorContext(
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
    expect(html).toContain('Test User')
    expect(html).toContain('Sign out')
  })
})
