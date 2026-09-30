import { config } from '../../../config/config.js'
import { getSessionUser } from './get-session-user.js'

const USER_COOKIE_NAME = config.get('userCookie.name')

describe('#getSessionUser', () => {
  test('Should return null when state is missing', () => {
    expect(getSessionUser({})).toBeNull()
  })

  test('Should return null when user cookie is absent', () => {
    expect(getSessionUser({ state: {} })).toBeNull()
  })

  test('Should return user when user cookie is present', () => {
    const user = { token: 'mock-token', profile: { oid: 'user-id' } }

    expect(getSessionUser({ state: { [USER_COOKIE_NAME]: user } })).toBe(user)
  })
})
