import path from 'node:path'
import { readFileSync } from 'node:fs'

import { config } from '../../config.js'
import {
  buildAccountNavigation,
  buildNavigation,
  buildRegulatorContext
} from './build-navigation.js'
import { buildGoogleTags } from './build-google-tags.js'
import { createLogger } from '../../../server/common/helpers/logging/logger.js'

const logger = createLogger()
const assetPath = config.get('assetPath')
const manifestPath = path.join(
  config.get('root'),
  '.public/assets-manifest.json'
)

let webpackManifest

export function context(request) {
  if (!webpackManifest) {
    try {
      webpackManifest = JSON.parse(readFileSync(manifestPath, 'utf-8'))
    } catch (error) {
      logger.error(`Webpack ${path.basename(manifestPath)} not found`)
    }
  }

  return {
    cspNonce: request?.plugins?.blankie?.nonces?.script,
    assetPath: `${assetPath}/assets`,
    serviceName: config.get('serviceName'),
    serviceUrl: '/',
    helpDeskEmail: config.get('helpDeskEmail'),
    breadcrumbs: [],
    navigation: buildNavigation(request),
    accountNavigation: buildAccountNavigation(request),
    regulatorContext: buildRegulatorContext(request),
    ...buildGoogleTags(request),
    hasCookiePolicy: !!request?.state?.cookies_policy,
    cookiePreferenceSet: request?.query?.cookie_preference === 'set',
    features: {
      certificateOfCompliance: config.get('features.certificateOfCompliance')
    },
    getAssetPath(asset) {
      const webpackAssetPath = webpackManifest?.[asset]
      return `${assetPath}/${webpackAssetPath ?? asset}`
    }
  }
}
