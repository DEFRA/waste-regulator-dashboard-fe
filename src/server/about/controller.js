/**
 * A GDS styled example about page controller.
 * Provided as an example, remove or modify as required.
 */
import { getLocale } from '../common/helpers/i18n/get-locale.js'
import { localeUrl } from '../common/helpers/i18n/locale-url.js'
import {
  buildPageViewModel,
  translate
} from '../common/helpers/i18n/translate.js'

export const aboutController = {
  handler(request, h) {
    const locale = getLocale(request)
    const { pageTitle, heading } = buildPageViewModel(request, 'about')

    return h.view('about/index', {
      pageTitle,
      heading,
      breadcrumbs: [
        {
          text: translate(locale, 'cookies.breadcrumbHome'),
          href: localeUrl('/', locale)
        },
        {
          text: translate(locale, 'about.heading')
        }
      ]
    })
  }
}
