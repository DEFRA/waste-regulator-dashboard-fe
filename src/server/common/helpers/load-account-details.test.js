import { describe, it, expect, vi } from 'vitest'
import { loadAccountDetails } from './load-account-details.js'
import * as getSessionUserModule from './get-session-user.js'
import * as accountApiServiceModule from '../services/account-api.service.js'

describe('loadAccountDetails', () => {
  it('returns undefined fields when no session user exists', async () => {
    vi.spyOn(getSessionUserModule, 'getSessionUser').mockReturnValueOnce(null)
    const request = {}

    const result = await loadAccountDetails(request)

    expect(result).toEqual({
      user: undefined,
      accountDetails: undefined,
      accountDetailsError: undefined
    })
  })

  it('sets error when userId cannot be determined from session user', async () => {
    const user = {}
    vi.spyOn(getSessionUserModule, 'getSessionUser').mockReturnValueOnce(user)
    vi.spyOn(
      accountApiServiceModule,
      'getAccountUserIdFromSessionUser'
    ).mockReturnValueOnce(null)
    const request = {}

    const result = await loadAccountDetails(request)

    expect(result.accountDetailsError).toBe(
      'We could not determine your user id.'
    )
    expect(request.app.accountDetailsError).toBe(
      'We could not determine your user id.'
    )
  })

  it('loads and maps account details successfully', async () => {
    const user = { profile: { oid: 'user-1' } }
    vi.spyOn(getSessionUserModule, 'getSessionUser').mockReturnValueOnce(user)
    vi.spyOn(
      accountApiServiceModule,
      'getAccountUserIdFromSessionUser'
    ).mockReturnValueOnce('user-1')

    const mockAccountApi = {
      getAccountDetails: vi.fn().mockResolvedValueOnce({
        firstName: 'Jane',
        lastName: 'Doe',
        serviceRoleId: 4
      })
    }
    vi.spyOn(
      accountApiServiceModule,
      'createAccountApiService'
    ).mockReturnValueOnce(mockAccountApi)

    const request = { headers: {} }
    const result = await loadAccountDetails(request)

    expect(result.accountDetails).toBeDefined()
    expect(result.accountDetails.firstName).toBe('Jane')
    expect(request.app.accountDetails).toBe(result.accountDetails)
    expect(request.app.accountDetailsError).toBeUndefined()
  })

  it('handles accountApi service failure gracefully', async () => {
    const user = { profile: { oid: 'user-1' } }
    vi.spyOn(getSessionUserModule, 'getSessionUser').mockReturnValueOnce(user)
    vi.spyOn(
      accountApiServiceModule,
      'getAccountUserIdFromSessionUser'
    ).mockReturnValueOnce('user-1')

    const mockAccountApi = {
      getAccountDetails: vi
        .fn()
        .mockRejectedValueOnce(new Error('Network error'))
    }
    vi.spyOn(
      accountApiServiceModule,
      'createAccountApiService'
    ).mockReturnValueOnce(mockAccountApi)

    const request = { logger: { error: vi.fn() } }
    const result = await loadAccountDetails(request)

    expect(result.accountDetails).toBeUndefined()
    expect(result.accountDetailsError).toBe(
      'We could not load your account details.'
    )
    expect(request.app.accountDetailsError).toBe(
      'We could not load your account details.'
    )
  })

  it('handles empty account details response gracefully', async () => {
    const user = { profile: { oid: 'user-1' } }
    vi.spyOn(getSessionUserModule, 'getSessionUser').mockReturnValueOnce(user)
    vi.spyOn(
      accountApiServiceModule,
      'getAccountUserIdFromSessionUser'
    ).mockReturnValueOnce('user-1')

    const mockAccountApi = {
      getAccountDetails: vi.fn().mockResolvedValueOnce(null)
    }
    vi.spyOn(
      accountApiServiceModule,
      'createAccountApiService'
    ).mockReturnValueOnce(mockAccountApi)

    const request = {}
    const result = await loadAccountDetails(request)

    expect(result.accountDetails).toBeUndefined()
    expect(result.accountDetailsError).toBe(
      'We could not load your account details.'
    )
  })

  it('handles account details mapped with empty strings and undefined role', async () => {
    const user = { profile: { oid: 'user-1' } }
    vi.spyOn(getSessionUserModule, 'getSessionUser').mockReturnValueOnce(user)
    vi.spyOn(
      accountApiServiceModule,
      'getAccountUserIdFromSessionUser'
    ).mockReturnValueOnce('user-1')

    const mockAccountApi = {
      getAccountDetails: vi.fn().mockResolvedValueOnce({})
    }
    vi.spyOn(
      accountApiServiceModule,
      'createAccountApiService'
    ).mockReturnValueOnce(mockAccountApi)
    vi.spyOn(
      accountApiServiceModule,
      'mapAccountDetailsDtoToViewModel'
    ).mockReturnValueOnce({
      firstName: '',
      lastName: '',
      organisationName: '',
      nationId: undefined,
      serviceRoleId: undefined
    })

    const request = {}
    const result = await loadAccountDetails(request)

    expect(result.accountDetails).toBeUndefined()
    expect(result.accountDetailsError).toBe(
      'We could not load your account details.'
    )
  })

  it('returns memoized accountDetails when already loaded on request.app', async () => {
    const user = { profile: { oid: 'user-1' } }
    vi.spyOn(getSessionUserModule, 'getSessionUser').mockReturnValueOnce(user)
    const createServiceSpy = vi.spyOn(
      accountApiServiceModule,
      'createAccountApiService'
    )

    const existingDetails = { firstName: 'Jane', serviceRoleId: 4 }
    const request = {
      app: {
        accountDetails: existingDetails
      }
    }

    const result = await loadAccountDetails(request)

    expect(result.accountDetails).toBe(existingDetails)
    expect(result.accountDetailsError).toBeUndefined()
    expect(createServiceSpy).not.toHaveBeenCalled()
  })

  it('returns memoized accountDetailsError when error already recorded on request.app', async () => {
    const user = { profile: { oid: 'user-1' } }
    vi.spyOn(getSessionUserModule, 'getSessionUser').mockReturnValueOnce(user)
    const createServiceSpy = vi.spyOn(
      accountApiServiceModule,
      'createAccountApiService'
    )

    const request = {
      app: {
        accountDetails: undefined,
        accountDetailsError: 'We could not load your account details.'
      }
    }

    const result = await loadAccountDetails(request)

    expect(result.accountDetails).toBeUndefined()
    expect(result.accountDetailsError).toBe(
      'We could not load your account details.'
    )
    expect(createServiceSpy).not.toHaveBeenCalled()
  })
})
