import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../config/config.js', () => ({
  config: {
    get: vi.fn((key) => {
      const values = {
        'accountApi.clientId': 'test-client-id',
        'accountApi.clientSecret': 'test-client-secret',
        'accountApi.scope': 'api://test/.default',
        'accountApi.tokenEndpoint': 'https://login.test/token'
      }
      return values[key]
    })
  }
}))

vi.mock('../common/services/apiBaseClient/oauth-token.js', () => ({
  getServiceOAuthAccessToken: vi.fn()
}))

import { runHealthChecks } from './health.service.js'
import { getServiceOAuthAccessToken } from '../common/services/apiBaseClient/oauth-token.js'

describe('runHealthChecks', () => {
  beforeEach(() => {
    getServiceOAuthAccessToken.mockResolvedValue('test-token')
  })

  it('returns success when the account token check passes', async () => {
    const result = await runHealthChecks()

    expect(result.message).toBe('success')
    expect(result.checks['account-token']).toEqual({ ok: true })
  })

  it('calls getServiceOAuthAccessToken with account API config', async () => {
    await runHealthChecks()

    expect(getServiceOAuthAccessToken).toHaveBeenCalledWith({
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      scope: 'api://test/.default',
      tokenEndpoint: 'https://login.test/token'
    })
  })

  it('returns degraded and records the error when the account token check fails', async () => {
    getServiceOAuthAccessToken.mockRejectedValue(
      new Error('OAuth token request failed (401 Unauthorized)')
    )

    const result = await runHealthChecks()

    expect(result.message).toBe('degraded')
    expect(result.checks['account-token']).toEqual({
      ok: false,
      error: 'OAuth token request failed (401 Unauthorized)'
    })
  })
})
