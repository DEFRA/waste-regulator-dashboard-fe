import { config } from '../../config/config.js'
import { statusCodes } from '../common/constants/status-codes.js'
import { runHealthChecks } from './health.service.js'

function getFeatures() {
  return {
    certificateOfCompliance: config.get('features.certificateOfCompliance')
  }
}

export const healthController = {
  handler(_request, h) {
    return h
      .response({ message: 'success', features: getFeatures() })
      .code(statusCodes.ok)
  }
}

export const healthAllController = {
  async handler(_request, h) {
    const features = getFeatures()

    if (config.get('useMockApi')) {
      return h.response({ message: 'success', features }).code(statusCodes.ok)
    }

    const result = await runHealthChecks()
    return h.response({ ...result, features }).code(statusCodes.ok)
  }
}
