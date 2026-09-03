import {
  buildPageViewModel,
  clearLocaleCacheForTests,
  pageI18n,
  seedLocaleDictionaryForTests,
  translate
} from './translate.js'

describe('translate', () => {
  beforeEach(() => {
    clearLocaleCacheForTests()
  })

  test('returns English string for known key', () => {
    expect(translate('en', 'common.serviceName')).toBe(
      "pEPR: Regulators' Service"
    )
  })

  test('interpolates params', () => {
    expect(
      translate('en', 'errors.serviceUnavailable.availableFrom', {
        availableFrom: '9am'
      })
    ).toBe('You will be able to use the service from 9am.')
  })

  test('falls back to English when Welsh key missing', () => {
    expect(translate('cy', 'cookies.intro1')).toBe(
      'Cookies are small files saved on your phone, tablet or computer when you visit a website.'
    )
  })

  test('falls back to English when Welsh value is blank', () => {
    clearLocaleCacheForTests()
    seedLocaleDictionaryForTests('cy', {
      common: { serviceName: '   ' }
    })

    expect(translate('cy', 'common.serviceName')).toBe(
      "pEPR: Regulators' Service"
    )
  })

  test('uses Welsh translation when present in cy.json', () => {
    expect(translate('cy', 'common.nav.home')).toBe('Hafan')
  })

  test('returns raw key when missing from both locales', () => {
    expect(translate('en', 'missing.key.path')).toBe('missing.key.path')
  })

  test('pageI18n scopes keys to page namespace', () => {
    const i18n = pageI18n('en', 'about')
    expect(i18n.t('heading')).toBe('About')
  })

  test('buildPageViewModel reads page title and heading from locale', () => {
    const viewModel = buildPageViewModel(
      { query: { lang: 'en' }, headers: {}, yar: { get: () => null } },
      'about'
    )

    expect(viewModel).toEqual({
      pageTitle: 'About',
      heading: 'About'
    })
  })
})
