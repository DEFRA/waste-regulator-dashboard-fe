import path from 'node:path'
import { readFileSync } from 'node:fs'

import { config } from '../../config.js'
import {
  buildAccountNavigation,
  buildNavigation,
  buildRegulatorContext
} from './build-navigation.js'
import { buildLanguageSwitcherUrls } from './build-language-switcher.js'
import { buildGoogleTags } from './build-google-tags.js'
import { createLogger } from '../../../server/common/helpers/logging/logger.js'
import { bindLocaleUrl, localeUrl } from '../../../server/common/helpers/i18n/locale-url.js'
import { getLocale } from '../../../server/common/helpers/i18n/get-locale.js'
import { translate } from '../../../server/common/helpers/i18n/translate.js'

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

  const locale = getLocale(request)

  return {
    cspNonce: request?.plugins?.blankie?.nonces?.script,
    assetPath: `${assetPath}/assets`,
    locale,
    localeUrl: bindLocaleUrl(locale),
    languageSwitcher: buildLanguageSwitcherUrls(request),
    serviceName: translate(locale, 'common.serviceName'),
    serviceUrl: localeUrl('/', locale),
    helpDeskEmail: config.get('helpDeskEmail'),
    breadcrumbs: [],
    navigation: buildNavigation(request),
    accountNavigation: buildAccountNavigation(request),
    regulatorContext: buildRegulatorContext(request, locale),
    ...buildGoogleTags(request),
    hasCookiePolicy: Boolean(request?.state?.cookies_policy),
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
