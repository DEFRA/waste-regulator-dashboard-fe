import { buildLanguageSwitcherUrls } from './build-language-switcher.js'

describe('buildLanguageSwitcherUrls', () => {
  test('builds en and cy URLs preserving other query params', () => {
    const request = {
      path: '/cookies',
      url: { search: '?success=1' }
    }

    expect(buildLanguageSwitcherUrls(request)).toEqual({
      en: '/cookies?success=1&lang=en',
      cy: '/cookies?success=1&lang=cy'
    })
  })

  test('builds URLs for root path without query', () => {
    const request = {
      path: '/',
      url: { search: '' }
    }

    expect(buildLanguageSwitcherUrls(request)).toEqual({
      en: '/?lang=en',
      cy: '/?lang=cy'
    })
  })
})
