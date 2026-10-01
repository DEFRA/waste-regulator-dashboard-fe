import { getSessionUser } from './get-session-user.js'

describe('#getSessionUser', () => {
  test('Should return null when yar is missing', () => {
    expect(getSessionUser({})).toBeNull()
  })

  test('Should return null when yar is not initialized', () => {
    expect(
      getSessionUser({
        yar: {
          id: null,
          get: () => {
            throw new Error('yar.get should not be called')
          }
        }
      })
    ).toBeNull()
  })

  test('Should return null when no user is stored', () => {
    expect(
      getSessionUser({
        yar: {
          id: 'session-id',
          get: () => null
        }
      })
    ).toBeNull()
  })

  test('Should return user when session is initialized and user exists', () => {
    const user = { token: 'mock-token', profile: { oid: 'user-id' } }

    expect(
      getSessionUser({
        yar: {
          id: 'session-id',
          get: (key) => (key === 'user' ? user : null)
        }
      })
    ).toBe(user)
  })
})
