import { describe, it, expect, vi, afterEach } from 'vitest'
import { config } from '../../config/config.js'
import {
  buildSiblingLogoutRedirectUrl,
  shouldChainSiblingLogout
} from './sibling-logout-redirect.js'

describe('sibling-logout-redirect', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('chains logout in mock auth mode when CSOC base URL is absolute', () => {
    vi.spyOn(config, 'get').mockImplementation((key) => {
      if (key === 'features.certificateOfCompliance') return true
      if (key === 'useMockAuth') return true
      if (key === 'services.certificateOfCompliance.baseUrl') {
        return 'https://localhost:3000'
      }
      return undefined
    })

    expect(shouldChainSiblingLogout()).toBe(true)
    expect(
      buildSiblingLogoutRedirectUrl('http://localhost:7154/signed-out')
    ).toBe(
      'https://localhost:3000/logout?returnTo=http%3A%2F%2Flocalhost%3A7154%2Fsigned-out'
    )
  })

  it('chains logout when CSOC base URL is absolute and feature is enabled', () => {
    vi.spyOn(config, 'get').mockImplementation((key) => {
      if (key === 'features.certificateOfCompliance') return true
      if (key === 'useMockAuth') return false
      if (key === 'services.certificateOfCompliance.baseUrl') {
        return 'https://localhost:3000'
      }
      return undefined
    })

    expect(shouldChainSiblingLogout()).toBe(true)
    expect(
      buildSiblingLogoutRedirectUrl('http://localhost:7154/signed-out')
    ).toBe(
      'https://localhost:3000/logout?returnTo=http%3A%2F%2Flocalhost%3A7154%2Fsigned-out'
    )
  })

  it('does not chain logout when CSOC base URL is a relative path', () => {
    vi.spyOn(config, 'get').mockImplementation((key) => {
      if (key === 'features.certificateOfCompliance') return true
      if (key === 'services.certificateOfCompliance.baseUrl') {
        return '/certificates-of-compliance'
      }
      return undefined
    })

    expect(shouldChainSiblingLogout()).toBe(false)
    expect(
      buildSiblingLogoutRedirectUrl('http://localhost:7154/signed-out')
    ).toBeNull()
  })
})
