import { describe, it, expect, vi } from 'vitest'
import {
  isRegulator,
  isRegulatorAdmin,
  regulatorRouteOptions,
  requireRegulatorRole
} from './regulator-access.js'
import { SESSION_USER_STRATEGY } from './session-user.js'
import * as loadAccountDetailsModule from '../common/helpers/load-account-details.js'

describe('isRegulator', () => {
  it('returns true for REGULATOR_ADMIN_SERVICE_ROLE_ID (4)', () => {
    expect(isRegulator({ serviceRoleId: 4 })).toBe(true)
  })

  it('returns true for REGULATOR_BASIC_SERVICE_ROLE_ID (5)', () => {
    expect(isRegulator({ serviceRoleId: 5 })).toBe(true)
  })

  it('returns false for other roles', () => {
    expect(isRegulator({ serviceRoleId: 3 })).toBe(false)
    expect(isRegulator({ serviceRoleId: 1 })).toBe(false)
  })

  it('returns false for null, undefined, or empty account details', () => {
    expect(isRegulator(null)).toBe(false)
    expect(isRegulator(undefined)).toBe(false)
    expect(isRegulator({})).toBe(false)
  })
})

describe('isRegulatorAdmin', () => {
  it('returns true for REGULATOR_ADMIN_SERVICE_ROLE_ID (4)', () => {
    expect(isRegulatorAdmin({ serviceRoleId: 4 })).toBe(true)
  })

  it('returns false for REGULATOR_BASIC_SERVICE_ROLE_ID (5)', () => {
    expect(isRegulatorAdmin({ serviceRoleId: 5 })).toBe(false)
  })

  it('returns false for other roles or missing details', () => {
    expect(isRegulatorAdmin({ serviceRoleId: 3 })).toBe(false)
    expect(isRegulatorAdmin(null)).toBe(false)
    expect(isRegulatorAdmin(undefined)).toBe(false)
  })
})

describe('requireRegulatorRole', () => {
  const mockH = { continue: Symbol('continue') }

  it('returns h.continue when request.app.accountDetails has a regulator role', async () => {
    const request = {
      app: {
        accountDetails: { serviceRoleId: 5 }
      }
    }

    const result = await requireRegulatorRole(request, mockH)
    expect(result).toBe(mockH.continue)
  })

  it('returns Boom.forbidden when request.app.accountDetails has a non-regulator role', async () => {
    const request = {
      app: {
        accountDetails: { serviceRoleId: 3 }
      }
    }

    const result = await requireRegulatorRole(request, mockH)
    expect(result.isBoom).toBe(true)
    expect(result.output.statusCode).toBe(403)
    expect(result.message).toBe('User does not hold a regulator service role')
  })

  it('loads account details when request.app has no accountDetails', async () => {
    const request = { app: {} }
    vi.spyOn(
      loadAccountDetailsModule,
      'loadAccountDetails'
    ).mockResolvedValueOnce({
      accountDetails: { serviceRoleId: 4 }
    })

    const result = await requireRegulatorRole(request, mockH)
    expect(result).toBe(mockH.continue)
  })

  it('does not re-load account details when request.app has accountDetailsError', async () => {
    const request = {
      app: {
        accountDetails: undefined,
        accountDetailsError: 'We could not load your account details.'
      }
    }
    const loadSpy = vi.spyOn(loadAccountDetailsModule, 'loadAccountDetails')

    const result = await requireRegulatorRole(request, mockH)
    expect(loadSpy).not.toHaveBeenCalled()
    expect(result.isBoom).toBe(true)
    expect(result.output.statusCode).toBe(403)
  })

  it('returns Boom.forbidden when loaded accountDetails is not a regulator', async () => {
    const request = {}
    vi.spyOn(
      loadAccountDetailsModule,
      'loadAccountDetails'
    ).mockResolvedValueOnce({
      accountDetails: { serviceRoleId: 2 }
    })

    const result = await requireRegulatorRole(request, mockH)
    expect(result.isBoom).toBe(true)
    expect(result.output.statusCode).toBe(403)
    expect(result.message).toBe('User does not hold a regulator service role')
  })
})

describe('regulatorRouteOptions', () => {
  it('bundles session-user auth strategy and requireRegulatorRole prerequisite', () => {
    expect(regulatorRouteOptions).toEqual({
      auth: SESSION_USER_STRATEGY,
      pre: [requireRegulatorRole]
    })
  })
})
