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

    const returnTo = 'http://localhost:7154/signed-out'

    expect(shouldChainSiblingLogout(returnTo)).toBe(true)
    expect(buildSiblingLogoutRedirectUrl(returnTo)).toBe(
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

    const returnTo = 'http://localhost:7154/signed-out'

    expect(shouldChainSiblingLogout(returnTo)).toBe(true)
    expect(buildSiblingLogoutRedirectUrl(returnTo)).toBe(
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

    const returnTo =
      'https://regulators-waste-proxy.dev.cdp-int.defra.cloud/dashboard/signed-out'

    expect(shouldChainSiblingLogout(returnTo)).toBe(false)
    expect(buildSiblingLogoutRedirectUrl(returnTo)).toBeNull()
  })

  it('does not chain logout when CSOC shares the reverse-proxy origin', () => {
    vi.spyOn(config, 'get').mockImplementation((key) => {
      if (key === 'features.certificateOfCompliance') return true
      if (key === 'services.certificateOfCompliance.baseUrl') {
        return 'https://regulators-waste-proxy.dev.cdp-int.defra.cloud/certificates-of-compliance'
      }
      return undefined
    })

    const returnTo =
      'https://regulators-waste-proxy.dev.cdp-int.defra.cloud/dashboard/signed-out'

    expect(shouldChainSiblingLogout(returnTo)).toBe(false)
    expect(buildSiblingLogoutRedirectUrl(returnTo)).toBeNull()
  })

  it('does not chain logout when CSOC base URL is the proxy host root', () => {
    vi.spyOn(config, 'get').mockImplementation((key) => {
      if (key === 'features.certificateOfCompliance') return true
      if (key === 'services.certificateOfCompliance.baseUrl') {
        return 'https://regulators-waste-proxy.dev.cdp-int.defra.cloud'
      }
      return undefined
    })

    const returnTo =
      'https://regulators-waste-proxy.dev.cdp-int.defra.cloud/dashboard/signed-out'

    expect(shouldChainSiblingLogout(returnTo)).toBe(false)
    expect(buildSiblingLogoutRedirectUrl(returnTo)).toBeNull()
  })

  it('builds logout under the CSOC path prefix when origins differ', () => {
    vi.spyOn(config, 'get').mockImplementation((key) => {
      if (key === 'features.certificateOfCompliance') return true
      if (key === 'services.certificateOfCompliance.baseUrl') {
        return 'https://csoc.example.com/certificates-of-compliance'
      }
      return undefined
    })

    const returnTo = 'https://dashboard.example.com/signed-out'

    expect(shouldChainSiblingLogout(returnTo)).toBe(true)
    expect(buildSiblingLogoutRedirectUrl(returnTo)).toBe(
      'https://csoc.example.com/certificates-of-compliance/logout?returnTo=https%3A%2F%2Fdashboard.example.com%2Fsigned-out'
    )
  })
})
