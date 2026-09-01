import { vi } from 'vitest'

import { createServer } from '../server.js'
import { statusCodes } from '../common/constants/status-codes.js'

vi.mock('./health.service.js', () => ({
  runHealthChecks: vi.fn()
}))

import { healthController } from './controller.js'
import { runHealthChecks } from './health.service.js'
import { config } from '../../config/config.js'

describe('#healthController', () => {
  describe('with default config', () => {
    let server

    beforeAll(async () => {
      server = await createServer()
      await server.initialize()
    })

    afterAll(async () => {
      await server.stop({ timeout: 0 })
    })

    test('returns success with feature flags without running checks when useMockApi is true', async () => {
      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: '/health'
      })

      expect(result).toEqual({
        message: 'success',
        features: { certificateOfCompliance: false }
      })
      expect(statusCode).toBe(statusCodes.ok)
      expect(runHealthChecks).not.toHaveBeenCalled()
    })
  })

  describe('with FEATURE_CERTIFICATE_OF_COMPLIANCE=true', () => {
    let server

    beforeAll(async () => {
      vi.stubEnv('FEATURE_CERTIFICATE_OF_COMPLIANCE', 'true')
      vi.resetModules()
      const { createServer: createFreshServer } = await import('../server.js')
      server = await createFreshServer()
      await server.initialize()
    })

    afterAll(async () => {
      await server.stop({ timeout: 0 })
      vi.unstubAllEnvs()
    })

    test('returns success with feature flag on without running checks', async () => {
      const { result, statusCode } = await server.inject({
        method: 'GET',
        url: '/health'
      })

      expect(result).toEqual({
        message: 'success',
        features: { certificateOfCompliance: true }
      })
      expect(statusCode).toBe(statusCodes.ok)
    })
  })
})

describe('healthController handler (non-mock mode)', () => {
  const h = { response: vi.fn() }

  beforeEach(() => {
    vi.spyOn(config, 'get').mockImplementation((key) => {
      if (key === 'useMockApi') return false
      if (key === 'features.certificateOfCompliance') return false
    })
    h.response.mockReturnValue({ code: vi.fn().mockReturnThis() })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.mocked(runHealthChecks).mockReset()
  })

  it('calls runHealthChecks and includes checks and features in the response', async () => {
    const checks = { 'account-token': { ok: true } }
    vi.mocked(runHealthChecks).mockResolvedValue({ message: 'success', checks })

    await healthController.handler({}, h)

    expect(runHealthChecks).toHaveBeenCalledOnce()
    expect(h.response).toHaveBeenCalledWith({
      message: 'success',
      checks,
      features: { certificateOfCompliance: false }
    })
  })

  it('returns 200 even when checks report degraded', async () => {
    const checks = {
      'account-token': { ok: false, error: 'OAuth token request failed (401 Unauthorized)' }
    }
    vi.mocked(runHealthChecks).mockResolvedValue({ message: 'degraded', checks })

    const responseObj = { code: vi.fn().mockReturnThis() }
    h.response.mockReturnValue(responseObj)

    await healthController.handler({}, h)

    expect(h.response).toHaveBeenCalledWith({
      message: 'degraded',
      checks,
      features: { certificateOfCompliance: false }
    })
    expect(responseObj.code).toHaveBeenCalledWith(statusCodes.ok)
  })
})
