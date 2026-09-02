import { config } from '../../config/config.js'
import { statusCodes } from '../common/constants/status-codes.js'
import { runHealthChecks } from './health.service.js'

export const healthController = {
  async handler(_request, h) {
    const features = {
      certificateOfCompliance: config.get('features.certificateOfCompliance')
    }

    if (config.get('useMockApi')) {
      return h.response({ message: 'success', features }).code(statusCodes.ok)
    }

    const result = await runHealthChecks()
    return h.response({ ...result, features }).code(statusCodes.ok)
  }
}
