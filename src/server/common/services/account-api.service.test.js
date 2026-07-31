import {
  mapAccountDetailsDtoToViewModel,
  getAccountUserIdFromSessionUser
} from './account-api.service.js'

describe('#mapAccountDetailsDtoToViewModel', () => {
  describe('organisationName from nationId', () => {
    test.each([
      [2, 'Northern Ireland Environment Agency'],
      [3, 'Scottish Environment Protection Agency'],
      [4, 'Natural Resources Wales']
    ])('nationId %i maps to "%s"', (nationId, expected) => {
      const result = mapAccountDetailsDtoToViewModel({ nationId })
      expect(result.organisationName).toBe(expected)
    })

    test.each([1, 0, 5, 99, null, undefined])(
      'nationId %s defaults to "Environment Agency"',
      (nationId) => {
        const result = mapAccountDetailsDtoToViewModel({ nationId })
        expect(result.organisationName).toBe('Environment Agency')
      }
    )
  })

  describe('field mapping', () => {
    const dto = {
      firstName: '  Jane  ',
      lastName: '  Smith  ',
      serviceRole: '  Regulator Admin  ',
      serviceRoleId: 4,
      contactEmail: '  jane.smith@example.org  ',
      nationId: 3
    }

    test('trims string fields', () => {
      const result = mapAccountDetailsDtoToViewModel(dto)
      expect(result.firstName).toBe('Jane')
      expect(result.lastName).toBe('Smith')
      expect(result.serviceRole).toBe('Regulator Admin')
      expect(result.email).toBe('jane.smith@example.org')
    })

    test('passes through serviceRoleId and nationId unchanged', () => {
      const result = mapAccountDetailsDtoToViewModel(dto)
      expect(result.serviceRoleId).toBe(4)
      expect(result.nationId).toBe(3)
    })

    test('maps contactEmail to email', () => {
      const result = mapAccountDetailsDtoToViewModel({
        contactEmail: 'a@b.com'
      })
      expect(result.email).toBe('a@b.com')
    })

    test('returns empty string for missing string fields', () => {
      const result = mapAccountDetailsDtoToViewModel({})
      expect(result.firstName).toBe('')
      expect(result.lastName).toBe('')
      expect(result.serviceRole).toBe('')
      expect(result.email).toBe('')
    })
  })
})

describe('#getAccountUserIdFromSessionUser', () => {
  test('returns oid from profile when present', () => {
    const user = { profile: { oid: 'a586e22f-0df0-4a24-8048-ae7d0aabbbbc' } }
    expect(getAccountUserIdFromSessionUser(user)).toBe(
      'a586e22f-0df0-4a24-8048-ae7d0aabbbbc'
    )
  })

  test('falls back to sub when oid is absent', () => {
    const user = { profile: { sub: 'b123e22f-0df0-4a24-8048-ae7d0aabbbbc' } }
    expect(getAccountUserIdFromSessionUser(user)).toBe(
      'b123e22f-0df0-4a24-8048-ae7d0aabbbbc'
    )
  })

  test('returns undefined when profile has no guid', () => {
    expect(getAccountUserIdFromSessionUser({ profile: {} })).toBeUndefined()
  })

  test('returns undefined for null', () => {
    expect(getAccountUserIdFromSessionUser(null)).toBeUndefined()
  })

  test('parses a guid string passed directly', () => {
    expect(
      getAccountUserIdFromSessionUser('a586e22f-0df0-4a24-8048-ae7d0aabbbbc')
    ).toBe('a586e22f-0df0-4a24-8048-ae7d0aabbbbc')
  })
})
